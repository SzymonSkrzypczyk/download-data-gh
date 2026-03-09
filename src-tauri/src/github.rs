use reqwest::Client;
use serde::{Deserialize, Serialize};
use tauri::State;
use crate::token::TokenState;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RepoMeta {
    pub owner: String,
    pub repo: String,
    pub description: Option<String>,
    pub stars: u64,
    pub forks: u64,
    pub private: bool,
    #[serde(rename = "defaultBranch")]
    pub default_branch: String,
    pub size_kb: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TreeNode {
    pub path: String,
    pub name: String,
    #[serde(rename = "type")]
    pub node_type: String, // "blob" or "tree"
    pub sha: String,
    pub size: Option<u64>,
    pub children: Option<Vec<TreeNode>>,
}

fn make_client(token: &Option<String>) -> reqwest::Client {
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert("User-Agent", "github-dir-downloader/1.0".parse().unwrap());
    headers.insert("Accept", "application/vnd.github+json".parse().unwrap());
    if let Some(t) = token {
        headers.insert(
            "Authorization",
            format!("Bearer {}", t).parse().unwrap(),
        );
    }
    Client::builder().default_headers(headers).build().unwrap()
}

#[tauri::command]
pub async fn fetch_repo_meta(
    owner: String,
    repo: String,
    state: State<'_, TokenState>,
) -> Result<RepoMeta, String> {
    let token = state.0.lock().unwrap().clone();
    let client = make_client(&token);
    let url = format!("https://api.github.com/repos/{}/{}", owner, repo);
    let resp: serde_json::Value = client.get(&url).send().await
        .map_err(|e| e.to_string())?
        .json().await.map_err(|e| e.to_string())?;

    if let Some(msg) = resp.get("message") {
        return Err(msg.as_str().unwrap_or("API error").to_string());
    }

    Ok(RepoMeta {
        owner,
        repo: resp["name"].as_str().unwrap_or("").to_string(),
        description: resp["description"].as_str().map(String::from),
        stars: resp["stargazers_count"].as_u64().unwrap_or(0),
        forks: resp["forks_count"].as_u64().unwrap_or(0),
        private: resp["private"].as_bool().unwrap_or(false),
        default_branch: resp["default_branch"].as_str().unwrap_or("main").to_string(),
        size_kb: resp["size"].as_u64().unwrap_or(0),
    })
}

#[tauri::command]
pub async fn fetch_repo_tree(
    owner: String,
    repo: String,
    branch: String,
    state: State<'_, TokenState>,
) -> Result<Vec<TreeNode>, String> {
    let token = state.0.lock().unwrap().clone();
    let client = make_client(&token);

    let url = format!(
        "https://api.github.com/repos/{}/{}/git/trees/{}?recursive=1",
        owner, repo, branch
    );
    let resp: serde_json::Value = client.get(&url).send().await
        .map_err(|e| e.to_string())?
        .json().await.map_err(|e| e.to_string())?;

    if resp["truncated"].as_bool().unwrap_or(false) {
        return Err("Repository tree is too large (>100k files). Partial tree display not yet supported.".to_string());
    }

    let flat: Vec<serde_json::Value> = resp["tree"]
        .as_array()
        .ok_or("Invalid tree response")?
        .to_vec();

    Ok(build_tree(flat))
}

fn build_tree(flat: Vec<serde_json::Value>) -> Vec<TreeNode> {
    use std::collections::HashMap;

    let mut nodes: Vec<TreeNode> = flat.into_iter().filter_map(|v| {
        let path = v["path"].as_str()?.to_string();
        let node_type = v["type"].as_str()?.to_string();
        let sha = v["sha"].as_str()?.to_string();
        let size = v["size"].as_u64();
        let name = path.split('/').last()?.to_string();
        
        Some(TreeNode {
            path,
            name,
            node_type,
            sha,
            size,
            children: None,
        })
    }).collect();

    // Sort by path length and then alphabetically to help build the tree
    nodes.sort_by(|a, b| a.path.len().cmp(&b.path.len()).then_with(|| a.path.cmp(&b.path)));

    let mut map: HashMap<String, TreeNode> = HashMap::new();
    let mut root_nodes: Vec<String> = Vec::new();

    for node in nodes {
        let path = node.path.clone();
        if !path.contains('/') {
            root_nodes.push(path.clone());
        }
        map.insert(path, node);
    }

    // Build hierarchy (bottom-up is easier with a map)
    let paths: Vec<String> = map.keys().cloned().collect();
    for path in paths {
        if let Some(idx) = path.rfind('/') {
            let parent_path = &path[..idx];
            let child = map.remove(&path).unwrap();
            if let Some(parent) = map.get_mut(parent_path) {
                if parent.children.is_none() {
                    parent.children = Some(Vec::new());
                }
                parent.children.as_mut().unwrap().push(child);
            }
        }
    }

    let mut result: Vec<TreeNode> = root_nodes.into_iter().filter_map(|p| map.remove(&p)).collect();
    
    // Sort children recursively
    fn sort_tree(nodes: &mut Vec<TreeNode>) {
        nodes.sort_by(|a, b| {
            let a_is_tree = a.node_type == "tree";
            let b_is_tree = b.node_type == "tree";
            if a_is_tree != b_is_tree {
                b_is_tree.cmp(&a_is_tree) // Trees first
            } else {
                a.name.cmp(&b.name)
            }
        });
        for node in nodes {
            if let Some(children) = &mut node.children {
                sort_tree(children);
            }
        }
    }
#[tauri::command]
pub async fn fetch_branches(
    owner: String,
    repo: String,
    state: State<'_, TokenState>,
) -> Result<Vec<String>, String> {
    let token = state.0.lock().unwrap().clone();
    let client = make_client(&token);
    let url = format!("https://api.github.com/repos/{}/{}/branches", owner, repo);
    let resp: serde_json::Value = client.get(&url).send().await
        .map_err(|e| e.to_string())?
        .json().await.map_err(|e| e.to_string())?;

    if let Some(msg) = resp.get("message") {
        return Err(msg.as_str().unwrap_or("API error").to_string());
    }

    let branches = resp.as_array()
        .ok_or("Invalid branches response")?
        .iter()
        .filter_map(|b| b["name"].as_str().map(String::from))
        .collect();

    Ok(branches)
}
