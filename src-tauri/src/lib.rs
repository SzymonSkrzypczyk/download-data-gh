mod token;
mod github;
mod download;

use std::sync::Mutex;
use token::TokenState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(TokenState(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            token::set_github_token,
            token::get_github_token,
            github::fetch_repo_meta,
            github::fetch_repo_tree,
            github::fetch_branches,
            download::download_directory,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
