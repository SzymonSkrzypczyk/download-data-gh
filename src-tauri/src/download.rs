use std::path::{Path, PathBuf};
use std::io::{Cursor, Read};
use tauri::{AppHandle, Emitter};
use zip::ZipArchive;
use crate::token::TokenState;

#[derive(serde::Serialize, Clone)]
struct DownloadProgress {
    stage: String,       // "downloading" | "extracting" | "done" | "error"
    progress: f32,       // 0.0 to 1.0
    message: String,
}

#[tauri::command]
pub async fn download_directory(
    owner: String,
    repo: String,
    branch: String,
    dir_path: String,      // e.g. "src/components"
    output_path: String,   // local destination folder chosen by user
    app: AppHandle,
    token_state: tauri::State<'_, TokenState>,
) -> Result<String, String> {
    let token = token_state.0.lock().unwrap().clone();

    // 1. Emit: downloading
    app.emit("download-progress", DownloadProgress {
        stage: "downloading".into(),
        progress: 0.0,
        message: format!("Downloading archive for {}/{}...", owner, repo),
    }).ok();

    // 2. Download the zipball
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert("User-Agent", "github-dir-downloader/1.0".parse().unwrap());
    headers.insert("Accept", "application/vnd.github+json".parse().unwrap());
    if let Some(t) = &token {
        headers.insert("Authorization", format!("Bearer {}", t).parse().unwrap());
    }
    let client = reqwest::Client::builder().default_headers(headers).build().unwrap();

    let url = format!(
        "https://api.github.com/repos/{}/{}/zipball/{}",
        owner, repo, branch
    );

    let response = client.get(&url)
        .send().await.map_err(|e| e.to_string())?;

    let bytes = response.bytes().await.map_err(|e| e.to_string())?;

    app.emit("download-progress", DownloadProgress {
        stage: "extracting".into(),
        progress: 0.5,
        message: format!("Extracting {} files...", dir_path),
    }).ok();

    // 3. Open zip and extract matching files
    let cursor = Cursor::new(bytes);
    let mut archive = ZipArchive::new(cursor).map_err(|e| e.to_string())?;
    let out_dir = PathBuf::from(&output_path);
    std::fs::create_dir_all(&out_dir).map_err(|e| e.to_string())?;

    let mut extracted = 0usize;
    let total_files = archive.len();

    // GitHub zipball wraps everything in a root folder like "owner-repo-sha/"
    // We need to strip that prefix and then match dir_path
    for i in 0..total_files {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let raw_path = file.name().to_string();

        // Strip leading "owner-repo-sha/" prefix
        let stripped = raw_path.splitn(2, '/').nth(1).unwrap_or(&raw_path);

        // Check if this entry is inside our target directory
        let prefix = format!("{}/", dir_path.trim_matches('/'));
        
        // Handle case where we are downloading the root directory or a specific folder
        let matches = if dir_path.is_empty() || dir_path == "." {
            true
        } else {
            stripped.starts_with(&prefix)
        };

        if !matches {
            continue;
        }

        // Compute relative output path
        let relative = if dir_path.is_empty() || dir_path == "." {
            stripped
        } else {
            &stripped[prefix.len()..]
        };
        
        if relative.is_empty() { continue; }
        let dest = out_dir.join(relative);

        if file.is_dir() {
            std::fs::create_dir_all(&dest).map_err(|e| e.to_string())?;
        } else {
            if let Some(parent) = dest.parent() {
                std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            let mut contents = Vec::new();
            file.read_to_end(&mut contents).map_err(|e| e.to_string())?;
            std::fs::write(&dest, contents).map_err(|e| e.to_string())?;
            extracted += 1;
        }

        let progress = 0.5 + (i as f32 / total_files as f32) * 0.5;
        app.emit("download-progress", DownloadProgress {
            stage: "extracting".into(),
            progress,
            message: format!("Extracted {} files...", extracted),
        }).ok();
    }

    app.emit("download-progress", DownloadProgress {
        stage: "done".into(),
        progress: 1.0,
        message: format!("Done! {} files saved to {}", extracted, output_path),
    }).ok();

    Ok(format!("{} files extracted to {}", extracted, output_path))
}
