use std::sync::Mutex;
use tauri::State;

pub struct TokenState(pub Mutex<Option<String>>);

#[tauri::command]
pub fn set_github_token(token: String, state: State<TokenState>) {
    let mut guard = state.0.lock().unwrap();
    *guard = if token.is_empty() { None } else { Some(token) };
}

#[tauri::command]
pub fn get_github_token(state: State<TokenState>) -> Option<String> {
    state.0.lock().unwrap().clone()
}
