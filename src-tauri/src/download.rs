use std::path::PathBuf;
use tauri::{AppHandle, Emitter};
use crate::token::TokenState;
use crate::github::{fetch_repo_tree_internal, make_client, TreeNode};
use futures_util::StreamExt;
use std::sync::Arc;
use tokio::sync::Semaphore;
use tokio::io::AsyncWriteExt;

#[derive(serde::Serialize, Clone)]
struct DownloadProgress {
    stage: String,       // "downloading" | "done" | "error"
    progress: f32,       // 0.0 to 1.0
    message: String,
}

#[tauri::command]
pub async fn download_directory(
    owner: String,
    repo: String,
    branch: String,
    dir_path: String,      // e.g. "src/components"
    output_path: String,   // local destination folder
    app: AppHandle,
    token_state: tauri::State<'_, TokenState>,
) -> Result<String, String> {
    let token = token_state.0.lock().unwrap().clone();
    let client = Arc::new(make_client(&token));

    // 1. Fetch the recursive tree to find all files in the directory
    app.emit("download-progress", DownloadProgress {
        stage: "downloading".into(),
        progress: 0.0,
        message: "Fetching repository file list...".into(),
    }).ok();

    let full_tree = fetch_repo_tree_internal(&owner, &repo, &branch, &token).await?;
    
    // Flatten the tree to get all blobs within the target dir_path
    let mut files_to_download = Vec::new();
    let target_prefix = if dir_path.is_empty() || dir_path == "." { 
        "".to_string() 
    } else { 
        format!("{}/", dir_path.trim_matches('/')) 
    };

    fn collect_blobs(nodes: &[TreeNode], target_prefix: &str, files: &mut Vec<TreeNode>) {
        for node in nodes {
            if node.node_type == "blob" {
                if target_prefix.is_empty() || node.path.starts_with(target_prefix) {
                    files.push(node.clone());
                }
            }
            if let Some(children) = &node.children {
                collect_blobs(children, target_prefix, files);
            }
        }
    }
    collect_blobs(&full_tree, &target_prefix, &mut files_to_download);

    let total_files = files_to_download.len();
    if total_files == 0 {
        return Err("No files found in selected directory".into());
    }

    // 2. Download files individually (Raw Download)
    let out_dir = Arc::new(PathBuf::from(&output_path));
    std::fs::create_dir_all(&*out_dir).map_err(|e| e.to_string())?;

    let downloaded_count = Arc::new(std::sync::atomic::AtomicUsize::new(0));
    let semaphore = Arc::new(Semaphore::new(10)); // Max 10 concurrent downloads

    let tasks = futures_util::stream::iter(files_to_download).map(|node| {
        let client = Arc::clone(&client);
        let out_dir = Arc::clone(&out_dir);
        let app = app.clone();
        let owner = owner.clone();
        let repo = repo.clone();
        let branch = branch.clone();
        let target_prefix = target_prefix.clone();
        let downloaded_count = Arc::clone(&downloaded_count);
        let semaphore = Arc::clone(&semaphore);
        let token = token.clone();

        async move {
            let _permit = semaphore.acquire().await.unwrap();
            
            // Construct relative destination path
            let relative_path = if target_prefix.is_empty() {
                &node.path
            } else {
                &node.path[target_prefix.len()..]
            };
            let dest = out_dir.join(relative_path);

            // Fetch raw content
            // Primary: Use the "github.com/.../raw/..." pattern with a browser-like User-Agent
            // This is the most reliable way to force GitHub to resolve LFS and serve the full file.
            let raw_url = format!("https://github.com/{}/{}/raw/{}/{}?download=", owner, repo, branch, node.path);
            
            // We use a browser-style client for this specific call to avoid being served LFS pointers
            // and headers to support private repositories
            let mut headers = reqwest::header::HeaderMap::new();
            if let Some(t) = &token {
                headers.insert("Authorization", format!("Bearer {}", t).parse().unwrap());
            }

            let browser_client = reqwest::Client::builder()
                .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                .default_headers(headers)
                .redirect(reqwest::redirect::Policy::limited(10))
                .build()
                .unwrap();

            let response = browser_client.get(&raw_url).send().await;
            
            let success = match response {
                Ok(resp) if resp.status().is_success() => {
                    if let Some(parent) = dest.parent() {
                        tokio::fs::create_dir_all(parent).await.map_err(|e| e.to_string())?;
                    }
                    let mut file = tokio::fs::File::create(&dest).await.map_err(|e| e.to_string())?;
                    let mut stream = resp.bytes_stream();
                    while let Some(chunk) = stream.next().await {
                        let chunk = chunk.map_err(|e| e.to_string())?;
                        file.write_all(&chunk).await.map_err(|e| e.to_string())?;
                    }
                    true
                }
                _ => false,
            };

            if !success {
                // FALLBACK 1: GitHub Content API (best for small/private files)
                let api_url = format!("https://api.github.com/repos/{}/{}/contents/{}?ref={}", owner, repo, node.path, branch);
                
                let api_response = client.get(&api_url)
                    .header("Accept", "application/vnd.github.v3.raw")
                    .send().await;

                let api_success = match api_response {
                    Ok(resp) if resp.status().is_success() => {
                        if let Some(parent) = dest.parent() {
                            tokio::fs::create_dir_all(parent).await.map_err(|e| e.to_string())?;
                        }
                        let mut file = tokio::fs::File::create(&dest).await.map_err(|e| e.to_string())?;
                        let mut stream = resp.bytes_stream();
                        while let Some(chunk) = stream.next().await {
                            let chunk = chunk.map_err(|e| e.to_string())?;
                            file.write_all(&chunk).await.map_err(|e| e.to_string())?;
                        }
                        true
                    }
                    _ => false,
                };

                if !api_success {
                    // FALLBACK 2: GitHub Git Data API (Blobs) - Best for large files (> 1MB)
                    // This uses the SHA which has much higher size limits
                    let blob_url = format!("https://api.github.com/repos/{}/{}/git/blobs/{}", owner, repo, node.sha);
                    
                    let blob_response = client.get(&blob_url)
                        .header("Accept", "application/vnd.github.v3.raw")
                        .send().await.map_err(|e| format!("Network error for {}: {}", node.path, e))?;

                    if !blob_response.status().is_success() {
                        let status = blob_response.status();
                        let body = blob_response.text().await.unwrap_or_default();
                        return Err(format!("Final download attempt failed for {}: {} - {}", node.path, status, body));
                    }

                    if let Some(parent) = dest.parent() {
                        tokio::fs::create_dir_all(parent).await.map_err(|e| e.to_string())?;
                    }
                    let mut file = tokio::fs::File::create(&dest).await.map_err(|e| e.to_string())?;
                    let mut stream = blob_response.bytes_stream();
                    while let Some(chunk) = stream.next().await {
                        let chunk = chunk.map_err(|e| e.to_string())?;
                        file.write_all(&chunk).await.map_err(|e| e.to_string())?;
                    }
                }
            }

            let current = downloaded_count.fetch_add(1, std::sync::atomic::Ordering::SeqCst) + 1;
            let progress = current as f32 / total_files as f32;
            
            app.emit("download-progress", DownloadProgress {
                stage: "downloading".into(),
                progress,
                message: format!("Downloading {}/{} ({})...", current, total_files, node.name),
            }).ok();

            Ok::<(), String>(())
        }
    }).buffer_unordered(10);

    let results: Vec<Result<(), String>> = tasks.collect().await;
    let errors: Vec<String> = results.into_iter().filter_map(|r| r.err()).collect();

    if !errors.is_empty() {
        return Err(format!("Download completed with errors: {}", errors.join("; ")));
    }

    app.emit("download-progress", DownloadProgress {
        stage: "done".into(),
        progress: 1.0,
        message: format!("Done! {} files saved to {}", total_files, output_path),
    }).ok();

    Ok(format!("{} files downloaded to {}", total_files, output_path))
}
