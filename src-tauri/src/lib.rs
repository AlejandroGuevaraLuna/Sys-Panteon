// Sistema de Administración de Panteón — Tauri backend
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![cerrar_aplicacion, abrir_en_explorador])
        .run(tauri::generate_context!())
        .expect("error while running panteon-admin application");
}

/// Mata el proceso de la aplicación completa. Es la forma más fiable de
/// cerrar la app en todas las plataformas (en macOS evita el "zombie en
/// el dock" que sucede cuando sólo se destruye la ventana).
#[tauri::command]
fn cerrar_aplicacion(app: tauri::AppHandle) {
    app.exit(0);
}

/// Abre una ruta en el explorador de archivos del sistema.
/// Útil para que el usuario navegue a la carpeta de respaldos.
#[tauri::command]
fn abrir_en_explorador(app: tauri::AppHandle, ruta: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_path(ruta, None::<&str>)
        .map_err(|e| e.to_string())
}
