use std::process::Command;
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use serde::{Deserialize, Serialize};
use notify::{Watcher, RecursiveMode, Event, EventKind};
use tokio::time::sleep;
use tokio::sync::mpsc;
use tauri::Emitter;
use chrono::{DateTime, Local};

#[derive(Serialize, Deserialize)]
struct GitStatus {
    status: String,
    error: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct GitInfo {
    branch: String,
    commit: String,
    error: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct GitInitResult {
    success: bool,
    message: String,
    was_initialized: bool,
    error: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct SnapshotResult {
    success: bool,
    message: String,
    error: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct FileWatcherConfig {
    project_path: String,
    log_file_path: Option<String>,
    debounce_duration: u64, // 毫秒
}

#[derive(Serialize, Deserialize)]
struct FileWatcherStatus {
    is_watching: bool,
    project_path: Option<String>,
    log_file_path: Option<String>,
    last_auto_commit: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct SnapshotHistoryItem {
    hash: String,
    date: String,
    message: String,
}

#[derive(Serialize, Deserialize)]
struct SnapshotHistory {
    success: bool,
    history: Vec<SnapshotHistoryItem>,
    error: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct RollbackResult {
    success: bool,
    message: String,
    error: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct SnapshotDiff {
    success: bool,
    files: Vec<String>,
    error: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct FileDiffContent {
    success: bool,
    diff_content: Option<String>,
    error: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct FriendlyDiffLine {
    content: String,
    change_type: String, // "added", "removed", "unchanged"
    line_number: Option<usize>,
}

#[derive(Serialize, Deserialize)]
struct FriendlyDiffContent {
    success: bool,
    summary: Option<String>,
    lines: Vec<FriendlyDiffLine>,
    error: Option<String>,
}

// 全局状态管理
struct AppState {
    file_watcher_config: Arc<Mutex<Option<FileWatcherConfig>>>,
    watcher_sender: Arc<Mutex<Option<mpsc::UnboundedSender<String>>>>,
}

// 日期格式化函数
fn format_git_date(date_str: &str) -> String {
    // Git 日期格式: "2023-10-25 10:00:00 +0800"
    // 尝试解析为 DateTime<FixedOffset>
    if let Ok(dt) = DateTime::parse_from_str(date_str, "%Y-%m-%d %H:%M:%S %z") {
        // 转换为本地时间
        let local_dt = dt.with_timezone(&Local);
        // 格式化为友好的中文格式
        local_dt.format("%Y年%m月%d日 %H:%M").to_string()
    } else {
        // 如果解析失败，返回原始字符串
        date_str.to_string()
    }
}

// Diff 清洗和解析函数
fn parse_friendly_diff(raw_diff: &str) -> FriendlyDiffContent {
    let lines: Vec<&str> = raw_diff.lines().collect();
    let mut friendly_lines = Vec::new();
    let mut added_count = 0;
    let mut removed_count = 0;
    let mut line_number = 1;
    
    for line in lines {
        // 跳过技术性行
        if line.starts_with("diff --git") ||
           line.starts_with("index ") ||
           line.starts_with("--- a/") ||
           line.starts_with("+++ b/") ||
           line.starts_with("@@") {
            continue;
        }
        
        // 处理实际的代码行
        if line.starts_with("+") && !line.starts_with("+++") {
            // 新增行
            friendly_lines.push(FriendlyDiffLine {
                content: line[1..].to_string(), // 移除 + 符号
                change_type: "added".to_string(),
                line_number: Some(line_number),
            });
            added_count += 1;
            line_number += 1;
        } else if line.starts_with("-") && !line.starts_with("---") {
            // 删除行
            friendly_lines.push(FriendlyDiffLine {
                content: line[1..].to_string(), // 移除 - 符号
                change_type: "removed".to_string(),
                line_number: None, // 删除的行不显示行号
            });
            removed_count += 1;
        } else if !line.is_empty() {
            // 未修改的行（上下文）
            friendly_lines.push(FriendlyDiffLine {
                content: line.to_string(),
                change_type: "unchanged".to_string(),
                line_number: Some(line_number),
            });
            line_number += 1;
        }
    }
    
    // 生成自然语言摘要
    let summary = if added_count > removed_count && added_count > 5 {
        Some("此快照在文件中添加了大量新内容。".to_string())
    } else if removed_count > added_count && removed_count > 5 {
        Some("此快照在文件中删除了部分旧代码。".to_string())
    } else if added_count > 0 && removed_count > 0 {
        Some(format!("此快照修改了文件内容，新增 {} 行，删除 {} 行。", added_count, removed_count))
    } else if added_count > 0 {
        Some(format!("此快照在文件中新增了 {} 行代码。", added_count))
    } else if removed_count > 0 {
        Some(format!("此快照从文件中删除了 {} 行代码。", removed_count))
    } else {
        Some("此快照未对文件内容进行修改。".to_string())
    };
    
    FriendlyDiffContent {
        success: true,
        summary,
        lines: friendly_lines,
        error: None,
    }
}

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn git_status(path: Option<String>) -> Result<GitStatus, String> {
    let work_dir = path.unwrap_or_else(|| ".".to_string());
    
    let output = Command::new("git")
        .arg("status")
        .arg("--porcelain")
        .current_dir(&work_dir)
        .output();
    
    match output {
        Ok(output) => {
            if output.status.success() {
                let status = String::from_utf8_lossy(&output.stdout).to_string();
                Ok(GitStatus {
                    status,
                    error: None,
                })
            } else {
                let error = String::from_utf8_lossy(&output.stderr).to_string();
                Ok(GitStatus {
                    status: String::new(),
                    error: Some(error),
                })
            }
        }
        Err(e) => {
            Ok(GitStatus {
                status: String::new(),
                error: Some(format!("Failed to execute git command: {}", e)),
            })
        }
    }
}

#[tauri::command]
async fn git_info(path: Option<String>) -> Result<GitInfo, String> {
    let work_dir = path.unwrap_or_else(|| ".".to_string());
    
    // Get current branch
    let branch_output = Command::new("git")
        .arg("branch")
        .arg("--show-current")
        .current_dir(&work_dir)
        .output();
    
    // Get latest commit hash
    let commit_output = Command::new("git")
        .arg("rev-parse")
        .arg("--short")
        .arg("HEAD")
        .current_dir(&work_dir)
        .output();
    
    let branch = match branch_output {
        Ok(output) => {
            if output.status.success() {
                String::from_utf8_lossy(&output.stdout).trim().to_string()
            } else {
                "unknown".to_string()
            }
        }
        Err(_) => "unknown".to_string(),
    };
    
    let commit = match commit_output {
        Ok(output) => {
            if output.status.success() {
                String::from_utf8_lossy(&output.stdout).trim().to_string()
            } else {
                "unknown".to_string()
            }
        }
        Err(_) => "unknown".to_string(),
    };
    
    Ok(GitInfo {
        branch,
        commit,
        error: None,
    })
}

#[tauri::command]
async fn git_log(path: Option<String>, count: Option<usize>) -> Result<Vec<String>, String> {
    let work_dir = path.unwrap_or_else(|| ".".to_string());
    let count = count.unwrap_or(10);
    
    let output = Command::new("git")
        .arg("log")
        .arg("--oneline")
        .arg(format!("-{}", count))
        .current_dir(&work_dir)
        .output();
    
    match output {
        Ok(output) => {
            if output.status.success() {
                let log_output = String::from_utf8_lossy(&output.stdout);
                let commits: Vec<String> = log_output
                    .lines()
                    .map(|line| line.to_string())
                    .collect();
                Ok(commits)
            } else {
                let error = String::from_utf8_lossy(&output.stderr).to_string();
                Err(format!("Git log failed: {}", error))
            }
        }
        Err(e) => Err(format!("Failed to execute git command: {}", e)),
    }
}

#[tauri::command]
async fn ensure_git_repo(project_path: String) -> Result<GitInitResult, String> {
    let work_dir = Path::new(&project_path);
    
    // 检查目录是否存在
    if !work_dir.exists() {
        return Ok(GitInitResult {
            success: false,
            message: "项目路径不存在".to_string(),
            was_initialized: false,
            error: Some("目录不存在".to_string()),
        });
    }
    
    // 检查是否已经是 Git 仓库
    let git_dir = work_dir.join(".git");
    if git_dir.exists() {
        return Ok(GitInitResult {
            success: true,
            message: "项目已成功关联。Git 仓库准备就绪。".to_string(),
            was_initialized: false,
            error: None,
        });
    }
    
    // 执行 Git 初始化
    let init_result = Command::new("git")
        .arg("init")
        .current_dir(&work_dir)
        .output();
    
    match init_result {
        Ok(output) => {
            if !output.status.success() {
                let error = String::from_utf8_lossy(&output.stderr).to_string();
                return Ok(GitInitResult {
                    success: false,
                    message: "Git 初始化失败".to_string(),
                    was_initialized: false,
                    error: Some(format!("git init 失败: {}", error)),
                });
            }
        }
        Err(e) => {
            return Ok(GitInitResult {
                success: false,
                message: "Git 初始化失败".to_string(),
                was_initialized: false,
                error: Some(format!("无法执行 git init: {}", e)),
            });
        }
    }
    
    // 配置 Git 用户信息
    let config_name_output = Command::new("git")
        .arg("config")
        .arg("user.name")
        .arg("VibeSnap User")
        .current_dir(&work_dir)
        .output();
    
    let config_email_output = Command::new("git")
        .arg("config")
        .arg("user.email")
        .arg("vibesnap@example.com")
        .current_dir(&work_dir)
        .output();
    
    // 检查配置是否成功（允许失败，因为可能已经有配置）
    if let Err(e) = config_name_output {
        println!("警告：配置 Git 用户名失败: {}", e);
    }
    if let Err(e) = config_email_output {
        println!("警告：配置 Git 邮箱失败: {}", e);
    }
    
    // 添加所有文件
    let add_result = Command::new("git")
        .arg("add")
        .arg(".")
        .current_dir(&work_dir)
        .output();
    
    match add_result {
        Ok(output) => {
            if !output.status.success() {
                let error = String::from_utf8_lossy(&output.stderr).to_string();
                return Ok(GitInitResult {
                    success: false,
                    message: "添加文件失败".to_string(),
                    was_initialized: true,
                    error: Some(format!("git add 失败: {}", error)),
                });
            }
        }
        Err(e) => {
            return Ok(GitInitResult {
                success: false,
                message: "添加文件失败".to_string(),
                was_initialized: true,
                error: Some(format!("无法执行 git add: {}", e)),
            });
        }
    }
    
    // 创建初始提交
    let commit_result = Command::new("git")
        .arg("commit")
        .arg("-m")
        .arg("VibeSnap 初始化项目")
        .current_dir(&work_dir)
        .output();
    
    match commit_result {
        Ok(output) => {
            if !output.status.success() {
                let error = String::from_utf8_lossy(&output.stderr).to_string();
                return Ok(GitInitResult {
                    success: false,
                    message: "创建初始提交失败".to_string(),
                    was_initialized: true,
                    error: Some(format!("git commit 失败: {}", error)),
                });
            }
        }
        Err(e) => {
            return Ok(GitInitResult {
                success: false,
                message: "创建初始提交失败".to_string(),
                was_initialized: true,
                error: Some(format!("无法执行 git commit: {}", e)),
            });
        }
    }
    
    // 成功完成初始化
    Ok(GitInitResult {
        success: true,
        message: "项目已成功关联。Git 仓库准备就绪。".to_string(),
        was_initialized: true,
        error: None,
    })
}

#[tauri::command]
async fn create_snapshot(project_path: String, prompt_message: String) -> Result<SnapshotResult, String> {
    let work_dir = Path::new(&project_path);
    
    // 检查目录是否存在
    if !work_dir.exists() {
        return Ok(SnapshotResult {
            success: false,
            message: "项目路径不存在".to_string(),
            error: Some("目录不存在".to_string()),
        });
    }
    
    // 检查是否是 Git 仓库
    let git_dir = work_dir.join(".git");
    if !git_dir.exists() {
        return Ok(SnapshotResult {
            success: false,
            message: "项目不是 Git 仓库".to_string(),
            error: Some("请先初始化项目".to_string()),
        });
    }
    
    // 检查输入消息是否为空
    if prompt_message.trim().is_empty() {
        return Ok(SnapshotResult {
            success: false,
            message: "请输入 AI 指令".to_string(),
            error: Some("消息不能为空".to_string()),
        });
    }
    
    // 执行 git add .
    let add_result = Command::new("git")
        .arg("add")
        .arg(".")
        .current_dir(&work_dir)
        .output();
    
    match add_result {
        Ok(output) => {
            if !output.status.success() {
                let error = String::from_utf8_lossy(&output.stderr).to_string();
                return Ok(SnapshotResult {
                    success: false,
                    message: "添加文件失败".to_string(),
                    error: Some(format!("git add 失败: {}", error)),
                });
            }
        }
        Err(e) => {
            return Ok(SnapshotResult {
                success: false,
                message: "添加文件失败".to_string(),
                error: Some(format!("无法执行 git add: {}", e)),
            });
        }
    }
    
    // 创建提交消息
    let commit_message = format!("[Vibe] AI Prompt: {}", prompt_message.trim());
    
    // 执行 git commit
    let commit_result = Command::new("git")
        .arg("commit")
        .arg("-m")
        .arg(&commit_message)
        .current_dir(&work_dir)
        .output();
    
    match commit_result {
        Ok(output) => {
            if !output.status.success() {
                let error = String::from_utf8_lossy(&output.stderr).to_string();
                // 检查是否是因为没有变更而失败
                if error.contains("nothing to commit") || error.contains("no changes added to commit") {
                    return Ok(SnapshotResult {
                        success: false,
                        message: "没有检测到变更".to_string(),
                        error: Some("工作区没有新的修改需要提交".to_string()),
                    });
                }
                // 提供更详细的错误诊断
                let detailed_error = if error.contains("user.name") || error.contains("user.email") {
                    format!("Git 用户信息未配置。错误详情: {}", error)
                } else if error.contains("nothing to commit") {
                    "没有检测到变更，工作区没有新的修改需要提交".to_string()
                } else {
                    format!("Git 提交失败。错误详情: {}", error)
                };
                
                return Ok(SnapshotResult {
                    success: false,
                    message: "创建快照失败".to_string(),
                    error: Some(detailed_error),
                });
            }
        }
        Err(e) => {
            return Ok(SnapshotResult {
                success: false,
                message: "创建快照失败".to_string(),
                error: Some(format!("无法执行 git commit: {}", e)),
            });
        }
    }
    
    // 成功创建快照
    Ok(SnapshotResult {
        success: true,
        message: "快照保存成功！".to_string(),
        error: None,
    })
}

// 任务 2: 日志文件内容提取
async fn get_latest_prompt(log_file_path: Option<&String>) -> String {
    if let Some(path) = log_file_path {
        match std::fs::read_to_string(path) {
            Ok(content) => {
                // 尝试从日志文件中提取最新的提示词
                let lines: Vec<&str> = content.lines().collect();
                if let Some(last_line) = lines.last() {
                    if !last_line.trim().is_empty() {
                        return last_line.trim().to_string();
                    }
                }
            }
            Err(_) => {
                // 日志文件读取失败，使用默认值
            }
        }
    }
    
    // 默认提示词
    "自动提交：AI 已修改文件".to_string()
}

// 任务 3: 自动化提交流程
async fn auto_commit_changes(project_path: &str, log_file_path: Option<&String>) -> Result<SnapshotResult, String> {
    // 获取最新的提示词
    let prompt = get_latest_prompt(log_file_path).await;
    
    // 执行 git add .
    let add_result = Command::new("git")
        .arg("add")
        .arg(".")
        .current_dir(project_path)
        .output();
    
    match add_result {
        Ok(output) => {
            if !output.status.success() {
                let error = String::from_utf8_lossy(&output.stderr).to_string();
                return Ok(SnapshotResult {
                    success: false,
                    message: "自动添加文件失败".to_string(),
                    error: Some(format!("git add 失败: {}", error)),
                });
            }
        }
        Err(e) => {
            return Ok(SnapshotResult {
                success: false,
                message: "自动添加文件失败".to_string(),
                error: Some(format!("无法执行 git add: {}", e)),
            });
        }
    }
    
    // 创建提交消息
    let commit_message = format!("[Vibe] AI Prompt: {}", prompt);
    
    // 执行 git commit
    let commit_result = Command::new("git")
        .arg("commit")
        .arg("-m")
        .arg(&commit_message)
        .current_dir(project_path)
        .output();
    
    match commit_result {
        Ok(output) => {
            if !output.status.success() {
                let error = String::from_utf8_lossy(&output.stderr).to_string();
                // 检查是否是因为没有变更而失败
                if error.contains("nothing to commit") || error.contains("no changes added to commit") {
                    return Ok(SnapshotResult {
                        success: false,
                        message: "没有检测到变更".to_string(),
                        error: Some("工作区没有新的修改需要提交".to_string()),
                    });
                }
                return Ok(SnapshotResult {
                    success: false,
                    message: "自动创建快照失败".to_string(),
                    error: Some(format!("git commit 失败: {}", error)),
                });
            }
        }
        Err(e) => {
            return Ok(SnapshotResult {
                success: false,
                message: "自动创建快照失败".to_string(),
                error: Some(format!("无法执行 git commit: {}", e)),
            });
        }
    }
    
    // 成功创建快照
    Ok(SnapshotResult {
        success: true,
        message: format!("已自动创建快照：{}", prompt),
        error: None,
    })
}

// 任务 1: 文件变动监听
#[tauri::command]
async fn start_file_watcher(
    project_path: String,
    log_file_path: Option<String>,
    debounce_duration: Option<u64>,
    app_handle: tauri::AppHandle,
) -> Result<FileWatcherStatus, String> {
    let debounce_ms = debounce_duration.unwrap_or(2000); // 默认2秒
    
    // 检查项目路径是否存在
    if !Path::new(&project_path).exists() {
        return Err("项目路径不存在".to_string());
    }
    
    // 检查是否是 Git 仓库
    let git_dir = Path::new(&project_path).join(".git");
    if !git_dir.exists() {
        return Err("项目不是 Git 仓库".to_string());
    }
    
    // 创建文件监听器
    let (_tx, mut rx) = mpsc::unbounded_channel::<String>();
    
    // 启动文件监听任务
    let project_path_clone = project_path.clone();
    let log_file_path_clone = log_file_path.clone();
    let app_handle_clone = app_handle.clone();
    
    tokio::spawn(async move {
        let (watcher_tx, mut watcher_rx) = mpsc::unbounded_channel::<notify::Result<Event>>();
        
        // 创建文件监听器
        let mut watcher = match notify::recommended_watcher(move |res| {
            let _ = watcher_tx.send(res);
        }) {
            Ok(w) => w,
            Err(e) => {
                eprintln!("创建文件监听器失败: {}", e);
                return;
            }
        };
        
        // 监听项目目录（排除 .git 文件夹）
        if let Err(e) = watcher.watch(Path::new(&project_path_clone), RecursiveMode::Recursive) {
            eprintln!("开始监听失败: {}", e);
            return;
        }
        
        println!("开始监听项目目录: {}", project_path_clone);
        
        // 发送初始状态到前端
        let _ = app_handle_clone.emit("file-watcher-status", "🟢 文件监听器已启动，等待文件变动...");
        
        // 防抖状态管理
        let mut debounce_timer: Option<tokio::task::JoinHandle<()>> = None;
        let debounce_duration = Duration::from_millis(debounce_ms);
        
        while let Some(event) = watcher_rx.recv().await {
            match event {
                Ok(event) => {
                    // 检查是否是文件修改事件
                    if matches!(event.kind, EventKind::Modify(_)) {
                        // 检查文件路径是否在 .git 文件夹内
                        let mut should_ignore = false;
                        for path in &event.paths {
                            if path.to_string_lossy().contains(".git") {
                                should_ignore = true;
                                break;
                            }
                        }
                        
                        if !should_ignore {
                            // 取消之前的计时器
                            if let Some(timer) = debounce_timer.take() {
                                timer.abort();
                            }
                            
                            // 发送状态更新
                            let _ = app_handle_clone.emit("file-watcher-status", "🔴 AI 正在修改文件，监听器等待静默中...");
                            
                            // 启动新的防抖计时器
                            let project_path_clone = project_path_clone.clone();
                            let log_file_path_clone = log_file_path_clone.clone();
                            let app_handle_clone = app_handle_clone.clone();
                            
                            debounce_timer = Some(tokio::spawn(async move {
                                sleep(debounce_duration).await;
                                
                                // 计时器结束，执行自动提交
                                match auto_commit_changes(&project_path_clone, log_file_path_clone.as_ref()).await {
                                    Ok(result) => {
                                        if result.success {
                                            println!("自动提交成功: {}", result.message);
                                            // 发送成功事件到前端
                                            let _ = app_handle_clone.emit("auto-commit-success", result.message);
                                            let _ = app_handle_clone.emit("file-watcher-status", "✅ 已自动创建快照");
                                        } else {
                                            println!("自动提交失败: {}", result.message);
                                            let _ = app_handle_clone.emit("auto-commit-error", result.message);
                                            let _ = app_handle_clone.emit("file-watcher-status", "❌ 自动提交失败");
                                        }
                                    }
                                    Err(e) => {
                                        println!("自动提交错误: {}", e);
                                        let _ = app_handle_clone.emit("auto-commit-error", e);
                                        let _ = app_handle_clone.emit("file-watcher-status", "❌ 自动提交错误");
                                    }
                                }
                            }));
                        }
                    }
                }
                Err(e) => {
                    eprintln!("文件监听错误: {}", e);
                }
            }
        }
    });
    
    // 启动消息接收任务
    tokio::spawn(async move {
        while let Some(_message) = rx.recv().await {
            // 处理来自文件监听的消息
        }
    });
    
    Ok(FileWatcherStatus {
        is_watching: true,
        project_path: Some(project_path),
        log_file_path,
        last_auto_commit: None,
    })
}

#[tauri::command]
async fn stop_file_watcher() -> Result<FileWatcherStatus, String> {
    // 停止文件监听
    Ok(FileWatcherStatus {
        is_watching: false,
        project_path: None,
        log_file_path: None,
        last_auto_commit: None,
    })
}

#[tauri::command]
async fn get_file_watcher_status() -> Result<FileWatcherStatus, String> {
    // 返回当前监听状态
    Ok(FileWatcherStatus {
        is_watching: false,
        project_path: None,
        log_file_path: None,
        last_auto_commit: None,
    })
}

// 任务 1: 获取历史记录
#[tauri::command]
async fn get_snapshot_history(project_path: String) -> Result<SnapshotHistory, String> {
    let work_dir = Path::new(&project_path);
    
    // 检查目录是否存在
    if !work_dir.exists() {
        return Ok(SnapshotHistory {
            success: false,
            history: vec![],
            error: Some("项目路径不存在".to_string()),
        });
    }
    
    // 检查是否是 Git 仓库
    let git_dir = work_dir.join(".git");
    if !git_dir.exists() {
        return Ok(SnapshotHistory {
            success: false,
            history: vec![],
            error: Some("项目不是 Git 仓库".to_string()),
        });
    }
    
    // 执行 git log 命令
    let output = Command::new("git")
        .arg("log")
        .arg("--pretty=format:%h|%ci|%s")
        .arg("--max-count=50")
        .current_dir(&work_dir)
        .output();
    
    match output {
        Ok(output) => {
            if output.status.success() {
                let log_output = String::from_utf8_lossy(&output.stdout);
                let mut history = Vec::new();
                
                for line in log_output.lines() {
                    if line.trim().is_empty() {
                        continue;
                    }
                    
                    let parts: Vec<&str> = line.split('|').collect();
                    if parts.len() >= 3 {
                        let hash = parts[0].trim().to_string();
                        let raw_date = parts[1].trim();
                        let formatted_date = format_git_date(raw_date);
                        let message = parts[2..].join("|").trim().to_string();
                        
                        history.push(SnapshotHistoryItem {
                            hash,
                            date: formatted_date,
                            message,
                        });
                    }
                }
                
                Ok(SnapshotHistory {
                    success: true,
                    history,
                    error: None,
                })
            } else {
                let error = String::from_utf8_lossy(&output.stderr).to_string();
                Ok(SnapshotHistory {
                    success: false,
                    history: vec![],
                    error: Some(format!("Git log 失败: {}", error)),
                })
            }
        }
        Err(e) => {
            Ok(SnapshotHistory {
                success: false,
                history: vec![],
                error: Some(format!("无法执行 git log: {}", e)),
            })
        }
    }
}

// 任务 3: 一键回退功能
#[tauri::command]
async fn rollback(project_path: String, hash: String) -> Result<RollbackResult, String> {
    let work_dir = Path::new(&project_path);
    
    // 检查目录是否存在
    if !work_dir.exists() {
        return Ok(RollbackResult {
            success: false,
            message: "项目路径不存在".to_string(),
            error: Some("目录不存在".to_string()),
        });
    }
    
    // 检查是否是 Git 仓库
    let git_dir = work_dir.join(".git");
    if !git_dir.exists() {
        return Ok(RollbackResult {
            success: false,
            message: "项目不是 Git 仓库".to_string(),
            error: Some("请先初始化项目".to_string()),
        });
    }
    
    // 检查 hash 是否为空
    if hash.trim().is_empty() {
        return Ok(RollbackResult {
            success: false,
            message: "提交哈希不能为空".to_string(),
            error: Some("无效的提交哈希".to_string()),
        });
    }
    
    // 执行 git reset --hard
    let output = Command::new("git")
        .arg("reset")
        .arg("--hard")
        .arg(&hash)
        .current_dir(&work_dir)
        .output();
    
    match output {
        Ok(output) => {
            if output.status.success() {
                Ok(RollbackResult {
                    success: true,
                    message: format!("✅ 成功回退到版本 {}", hash),
                    error: None,
                })
            } else {
                let error = String::from_utf8_lossy(&output.stderr).to_string();
                Ok(RollbackResult {
                    success: false,
                    message: "回退失败".to_string(),
                    error: Some(format!("git reset 失败: {}", error)),
                })
            }
        }
        Err(e) => {
            Ok(RollbackResult {
                success: false,
                message: "回退失败".to_string(),
                error: Some(format!("无法执行 git reset: {}", e)),
            })
        }
    }
}

// 获取快照修改详情
#[tauri::command]
async fn get_snapshot_diff(project_path: String, hash: String) -> Result<SnapshotDiff, String> {
    let work_dir = Path::new(&project_path);
    
    // 检查目录是否存在
    if !work_dir.exists() {
        return Ok(SnapshotDiff {
            success: false,
            files: vec![],
            error: Some("项目路径不存在".to_string()),
        });
    }
    
    // 检查是否是 Git 仓库
    let git_dir = work_dir.join(".git");
    if !git_dir.exists() {
        return Ok(SnapshotDiff {
            success: false,
            files: vec![],
            error: Some("项目不是 Git 仓库".to_string()),
        });
    }
    
    // 检查 hash 是否为空
    if hash.trim().is_empty() {
        return Ok(SnapshotDiff {
            success: false,
            files: vec![],
            error: Some("提交哈希不能为空".to_string()),
        });
    }
    
    // 执行 git show 命令获取修改的文件列表
    let output = Command::new("git")
        .arg("show")
        .arg("--pretty=format:")
        .arg("--name-only")
        .arg(&hash)
        .current_dir(&work_dir)
        .output();
    
    match output {
        Ok(output) => {
            if output.status.success() {
                let diff_output = String::from_utf8_lossy(&output.stdout);
                let files: Vec<String> = diff_output
                    .lines()
                    .filter(|line| !line.trim().is_empty())
                    .map(|line| line.trim().to_string())
                    .collect();
                
                Ok(SnapshotDiff {
                    success: true,
                    files,
                    error: None,
                })
            } else {
                let error = String::from_utf8_lossy(&output.stderr).to_string();
                Ok(SnapshotDiff {
                    success: false,
                    files: vec![],
                    error: Some(format!("Git show 失败: {}", error)),
                })
            }
        }
        Err(e) => {
            Ok(SnapshotDiff {
                success: false,
                files: vec![],
                error: Some(format!("无法执行 git show: {}", e)),
            })
        }
    }
}

// 获取文件差异内容
#[tauri::command]
async fn get_file_diff_content(project_path: String, hash: String, file_path: String) -> Result<FileDiffContent, String> {
    let work_dir = Path::new(&project_path);
    
    // 检查目录是否存在
    if !work_dir.exists() {
        return Ok(FileDiffContent {
            success: false,
            diff_content: None,
            error: Some("项目路径不存在".to_string()),
        });
    }
    
    // 检查是否是 Git 仓库
    let git_dir = work_dir.join(".git");
    if !git_dir.exists() {
        return Ok(FileDiffContent {
            success: false,
            diff_content: None,
            error: Some("项目不是 Git 仓库".to_string()),
        });
    }
    
    // 检查参数是否为空
    if hash.trim().is_empty() || file_path.trim().is_empty() {
        return Ok(FileDiffContent {
            success: false,
            diff_content: None,
            error: Some("提交哈希和文件路径不能为空".to_string()),
        });
    }
    
    // 首先检查该提交是否有父提交
    let parent_check = Command::new("git")
        .arg("rev-parse")
        .arg(&format!("{}^", hash))
        .current_dir(&work_dir)
        .output();
    
    let has_parent = match parent_check {
        Ok(output) => output.status.success(),
        Err(_) => false,
    };
    
    // 如果没有父提交（第一个提交），直接显示文件内容
    if !has_parent {
        let file_output = Command::new("git")
            .arg("show")
            .arg(&format!("{}:{}", hash, file_path))
            .current_dir(&work_dir)
            .output();
        
        match file_output {
            Ok(file_output) => {
                if file_output.status.success() {
                    let file_content = String::from_utf8_lossy(&file_output.stdout).to_string();
                    let lines: Vec<&str> = file_content.lines().collect();
                    let hash_short = if hash.len() >= 8 { &hash[..8] } else { &hash };
                    let formatted_content = format!(
                        "--- 文件内容 (初始提交 {})\n+++ {}\n@@ -0,0 +1,{} @@\n{}", 
                        hash_short, 
                        file_path,
                        lines.len(),
                        lines.iter().map(|line| format!("+{}", line)).collect::<Vec<_>>().join("\n")
                    );
                    
                    return Ok(FileDiffContent {
                        success: true,
                        diff_content: Some(formatted_content),
                        error: None,
                    });
                } else {
                    let error = String::from_utf8_lossy(&file_output.stderr).to_string();
                    return Ok(FileDiffContent {
                        success: false,
                        diff_content: None,
                        error: Some(format!("获取文件内容失败: {}", error)),
                    });
                }
            }
            Err(e) => {
                return Ok(FileDiffContent {
                    success: false,
                    diff_content: None,
                    error: Some(format!("无法执行 git show: {}", e)),
                });
            }
        }
    }
    
    // 有父提交，执行正常的 git diff 命令
    let output = Command::new("git")
        .arg("diff")
        .arg(&format!("{}^", hash))
        .arg(&hash)
        .arg("--")
        .arg(&file_path)
        .current_dir(&work_dir)
        .output();
    
    match output {
        Ok(output) => {
            if output.status.success() {
                let diff_output = String::from_utf8_lossy(&output.stdout).to_string();
                
                // 如果没有差异内容，尝试获取文件内容
                if diff_output.trim().is_empty() {
                    // 获取文件在该快照版本的内容
                    let file_output = Command::new("git")
                        .arg("show")
                        .arg(&format!("{}:{}", hash, file_path))
                        .current_dir(&work_dir)
                        .output();
                    
                    match file_output {
                        Ok(file_output) => {
                            if file_output.status.success() {
                                let file_content = String::from_utf8_lossy(&file_output.stdout).to_string();
                                Ok(FileDiffContent {
                                    success: true,
                                    diff_content: Some(format!("--- 文件内容 (快照 {})\n+++ {}\n@@ -1,1 +1,{} @@\n{}", 
                                        &hash[..8], 
                                        file_path,
                                        file_content.lines().count(),
                                        file_content.lines().map(|line| format!("+{}", line)).collect::<Vec<_>>().join("\n")
                                    )),
                                    error: None,
                                })
                            } else {
                                let error = String::from_utf8_lossy(&file_output.stderr).to_string();
                                Ok(FileDiffContent {
                                    success: false,
                                    diff_content: None,
                                    error: Some(format!("获取文件内容失败: {}", error)),
                                })
                            }
                        }
                        Err(e) => {
                            Ok(FileDiffContent {
                                success: false,
                                diff_content: None,
                                error: Some(format!("无法执行 git show: {}", e)),
                            })
                        }
                    }
                } else {
                    Ok(FileDiffContent {
                        success: true,
                        diff_content: Some(diff_output),
                        error: None,
                    })
                }
            } else {
                let error = String::from_utf8_lossy(&output.stderr).to_string();
                Ok(FileDiffContent {
                    success: false,
                    diff_content: None,
                    error: Some(format!("Git diff 失败: {}", error)),
                })
            }
        }
        Err(e) => {
            Ok(FileDiffContent {
                success: false,
                diff_content: None,
                error: Some(format!("无法执行 git diff: {}", e)),
            })
        }
    }
}

// 获取用户友好的文件差异内容
#[tauri::command]
async fn get_friendly_diff_content(project_path: String, hash: String, file_path: String) -> Result<FriendlyDiffContent, String> {
    let work_dir = Path::new(&project_path);
    
    // 检查目录是否存在
    if !work_dir.exists() {
        return Ok(FriendlyDiffContent {
            success: false,
            summary: None,
            lines: vec![],
            error: Some("项目路径不存在".to_string()),
        });
    }
    
    // 检查是否是 Git 仓库
    let git_dir = work_dir.join(".git");
    if !git_dir.exists() {
        return Ok(FriendlyDiffContent {
            success: false,
            summary: None,
            lines: vec![],
            error: Some("项目不是 Git 仓库".to_string()),
        });
    }
    
    // 检查参数是否为空
    if hash.trim().is_empty() || file_path.trim().is_empty() {
        return Ok(FriendlyDiffContent {
            success: false,
            summary: None,
            lines: vec![],
            error: Some("提交哈希和文件路径不能为空".to_string()),
        });
    }
    
    // 首先检查该提交是否有父提交
    let parent_check = Command::new("git")
        .arg("rev-parse")
        .arg(&format!("{}^", hash))
        .current_dir(&work_dir)
        .output();
    
    let has_parent = match parent_check {
        Ok(output) => output.status.success(),
        Err(_) => false,
    };
    
    // 如果没有父提交（第一个提交），直接显示文件内容
    if !has_parent {
        let file_output = Command::new("git")
            .arg("show")
            .arg(&format!("{}:{}", hash, file_path))
            .current_dir(&work_dir)
            .output();
        
        match file_output {
            Ok(file_output) => {
                if file_output.status.success() {
                    let file_content = String::from_utf8_lossy(&file_output.stdout).to_string();
                    let lines: Vec<&str> = file_content.lines().collect();
                    
                    // 为第一个提交创建友好的差异内容
                    let friendly_lines: Vec<FriendlyDiffLine> = lines.iter().enumerate().map(|(i, line)| {
                        FriendlyDiffLine {
                            content: line.to_string(),
                            change_type: "added".to_string(),
                            line_number: Some(i + 1),
                        }
                    }).collect();
                    
                    return Ok(FriendlyDiffContent {
                        success: true,
                        summary: Some(format!("此快照是文件的初始版本，包含 {} 行代码。", lines.len())),
                        lines: friendly_lines,
                        error: None,
                    });
                } else {
                    let error = String::from_utf8_lossy(&file_output.stderr).to_string();
                    return Ok(FriendlyDiffContent {
                        success: false,
                        summary: None,
                        lines: vec![],
                        error: Some(format!("获取文件内容失败: {}", error)),
                    });
                }
            }
            Err(e) => {
                return Ok(FriendlyDiffContent {
                    success: false,
                    summary: None,
                    lines: vec![],
                    error: Some(format!("无法执行 git show: {}", e)),
                });
            }
        }
    }
    
    // 有父提交，执行正常的 git diff 命令
    let output = Command::new("git")
        .arg("diff")
        .arg(&format!("{}^", hash))
        .arg(&hash)
        .arg("--")
        .arg(&file_path)
        .current_dir(&work_dir)
        .output();
    
    match output {
        Ok(output) => {
            if output.status.success() {
                let diff_output = String::from_utf8_lossy(&output.stdout).to_string();
                
                // 如果没有差异内容，尝试获取文件内容
                if diff_output.trim().is_empty() {
                    // 获取文件在该快照版本的内容
                    let file_output = Command::new("git")
                        .arg("show")
                        .arg(&format!("{}:{}", hash, file_path))
                        .current_dir(&work_dir)
                        .output();
                    
                    match file_output {
                        Ok(file_output) => {
                            if file_output.status.success() {
                                let file_content = String::from_utf8_lossy(&file_output.stdout).to_string();
                                let lines: Vec<&str> = file_content.lines().collect();
                                
                                // 创建友好的差异内容（显示为未修改）
                                let friendly_lines: Vec<FriendlyDiffLine> = lines.iter().enumerate().map(|(i, line)| {
                                    FriendlyDiffLine {
                                        content: line.to_string(),
                                        change_type: "unchanged".to_string(),
                                        line_number: Some(i + 1),
                                    }
                                }).collect();
                                
                                return Ok(FriendlyDiffContent {
                                    success: true,
                                    summary: Some("此快照未对文件内容进行修改。".to_string()),
                                    lines: friendly_lines,
                                    error: None,
                                });
                            } else {
                                let error = String::from_utf8_lossy(&file_output.stderr).to_string();
                                return Ok(FriendlyDiffContent {
                                    success: false,
                                    summary: None,
                                    lines: vec![],
                                    error: Some(format!("获取文件内容失败: {}", error)),
                                });
                            }
                        }
                        Err(e) => {
                            return Ok(FriendlyDiffContent {
                                success: false,
                                summary: None,
                                lines: vec![],
                                error: Some(format!("无法执行 git show: {}", e)),
                            });
                        }
                    }
                } else {
                    // 解析差异内容
                    Ok(parse_friendly_diff(&diff_output))
                }
            } else {
                let error = String::from_utf8_lossy(&output.stderr).to_string();
                Ok(FriendlyDiffContent {
                    success: false,
                    summary: None,
                    lines: vec![],
                    error: Some(format!("Git diff 失败: {}", error)),
                })
            }
        }
        Err(e) => {
            Ok(FriendlyDiffContent {
                success: false,
                summary: None,
                lines: vec![],
                error: Some(format!("无法执行 git diff: {}", e)),
            })
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .invoke_handler(tauri::generate_handler![greet, git_status, git_info, git_log, ensure_git_repo, create_snapshot, start_file_watcher, stop_file_watcher, get_file_watcher_status, get_snapshot_history, rollback, get_snapshot_diff, get_file_diff_content, get_friendly_diff_content])
    .setup(|_app| {
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
