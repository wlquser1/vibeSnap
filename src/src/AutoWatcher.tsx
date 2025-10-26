import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

interface AutoWatcherProps {
  projectPath: string;
  onAutoCommit: (success: boolean, message: string) => void;
}

export const AutoWatcher: React.FC<AutoWatcherProps> = ({ 
  projectPath, 
  onAutoCommit 
}) => {
  const [isWatching, setIsWatching] = useState(false);
  const [logFilePath, setLogFilePath] = useState('');
  const [debounceDuration, setDebounceDuration] = useState(2000);
  const [watcherStatus, setWatcherStatus] = useState<any>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [fileWatcherStatus, setFileWatcherStatus] = useState<string>('🟢 文件监听器未启动');

  // 监听自动提交事件
  useEffect(() => {
    const unlistenSuccess = listen('auto-commit-success', (event) => {
      onAutoCommit(true, event.payload as string);
    });

    const unlistenError = listen('auto-commit-error', (event) => {
      onAutoCommit(false, event.payload as string);
    });

    const unlistenFileWatcherStatus = listen('file-watcher-status', (event) => {
      setFileWatcherStatus(event.payload as string);
    });

    return () => {
      unlistenSuccess.then(fn => fn());
      unlistenError.then(fn => fn());
      unlistenFileWatcherStatus.then(fn => fn());
    };
  }, [onAutoCommit]);

  // 获取当前监听状态
  const getWatcherStatus = async () => {
    try {
      const status = await invoke<any>('get_file_watcher_status');
      setWatcherStatus(status);
      setIsWatching(status.is_watching);
    } catch (error) {
      console.error('获取监听状态失败:', error);
    }
  };

  useEffect(() => {
    getWatcherStatus();
  }, []);

  const handleStartWatching = async () => {
    if (!projectPath) {
      onAutoCommit(false, '请先选择项目文件夹');
      return;
    }

    setIsStarting(true);

    try {
      const result = await invoke<any>('start_file_watcher', {
        projectPath: projectPath,
        logFilePath: logFilePath.trim() || null,
        debounceDuration: debounceDuration
      });

      if (result.is_watching) {
        setIsWatching(true);
        setWatcherStatus(result);
        onAutoCommit(true, '自动监听已启动');
      } else {
        onAutoCommit(false, '启动自动监听失败');
      }
    } catch (error) {
      onAutoCommit(false, `启动自动监听失败: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsStarting(false);
    }
  };

  const handleStopWatching = async () => {
    try {
      const result = await invoke<any>('stop_file_watcher');
      setIsWatching(false);
      setWatcherStatus(result);
      onAutoCommit(true, '自动监听已停止');
    } catch (error) {
      onAutoCommit(false, `停止自动监听失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleLogFileSelect = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        title: '选择 AI 工具日志文件',
        filters: [
          { name: 'Log Files', extensions: ['log', 'txt'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (selected) {
        setLogFilePath(selected as string);
      }
    } catch (error) {
      console.error('选择日志文件失败:', error);
    }
  };

  return (
    <div style={{
      padding: '20px',
      margin: '20px',
      backgroundColor: '#f8f9fa',
      borderRadius: '8px',
      border: '1px solid #dee2e6'
    }}>
      <h3 style={{ 
        margin: '0 0 15px 0',
        color: '#495057',
        fontSize: '18px'
      }}>
        🤖 自动监听设置
      </h3>
      
      <p style={{ 
        margin: '0 0 15px 0',
        color: '#6c757d',
        fontSize: '14px'
      }}>
        启用后，系统将自动监听文件变动并创建快照
      </p>

      {/* 日志文件路径设置 */}
      <div style={{ marginBottom: '15px' }}>
        <label style={{ 
          display: 'block', 
          marginBottom: '5px',
          fontWeight: 'bold',
          color: '#495057'
        }}>
          AI 工具日志文件路径 (可选):
        </label>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            value={logFilePath}
            onChange={(e) => setLogFilePath(e.target.value)}
            placeholder="例如: /Users/username/.ai_prompts.log"
            style={{
              flex: 1,
              padding: '8px 12px',
              border: '1px solid #ced4da',
              borderRadius: '4px',
              fontSize: '14px'
            }}
          />
          <button
            onClick={handleLogFileSelect}
            style={{
              padding: '8px 16px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            选择文件
          </button>
        </div>
        <p style={{ 
          margin: '5px 0 0 0',
          fontSize: '12px',
          color: '#6c757d'
        }}>
          如果指定了日志文件，系统将从该文件读取最新的 AI 指令作为提交信息
        </p>
      </div>

      {/* 防抖时间设置 */}
      <div style={{ marginBottom: '15px' }}>
        <label style={{ 
          display: 'block', 
          marginBottom: '5px',
          fontWeight: 'bold',
          color: '#495057'
        }}>
          防抖时间 (毫秒):
        </label>
        <input
          type="number"
          value={debounceDuration}
          onChange={(e) => setDebounceDuration(parseInt(e.target.value) || 2000)}
          min="500"
          max="10000"
          step="500"
          style={{
            padding: '8px 12px',
            border: '1px solid #ced4da',
            borderRadius: '4px',
            fontSize: '14px',
            width: '120px'
          }}
        />
        <p style={{ 
          margin: '5px 0 0 0',
          fontSize: '12px',
          color: '#6c757d'
        }}>
          文件停止变动后等待多长时间再自动提交
        </p>
      </div>

      {/* 控制按钮 */}
      <div style={{ marginBottom: '15px' }}>
        {!isWatching ? (
          <button
            onClick={handleStartWatching}
            disabled={isStarting || !projectPath}
            style={{
              padding: '12px 24px',
              backgroundColor: isStarting ? '#6c757d' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: isStarting || !projectPath ? 'not-allowed' : 'pointer',
              opacity: isStarting || !projectPath ? 0.6 : 1,
              marginRight: '10px'
            }}
          >
            {isStarting ? '启动中...' : '🚀 启动自动监听'}
          </button>
        ) : (
          <button
            onClick={handleStopWatching}
            style={{
              padding: '12px 24px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            🛑 停止自动监听
          </button>
        )}
      </div>

      {/* 文件监听状态显示 */}
      <div style={{
        padding: '12px',
        backgroundColor: '#f8f9fa',
        border: '1px solid #dee2e6',
        borderRadius: '4px',
        marginBottom: '15px'
      }}>
        <div style={{
          fontSize: '14px',
          fontWeight: 'bold',
          marginBottom: '5px',
          color: '#495057'
        }}>
          📡 文件监听状态:
        </div>
        <div style={{
          fontSize: '13px',
          color: '#6c757d',
          fontFamily: 'monospace'
        }}>
          {fileWatcherStatus}
        </div>
      </div>

      {/* 状态显示 */}
      {watcherStatus && (
        <div style={{
          padding: '10px',
          backgroundColor: isWatching ? '#d4edda' : '#f8d7da',
          border: `1px solid ${isWatching ? '#c3e6cb' : '#f5c6cb'}`,
          borderRadius: '4px',
          fontSize: '14px'
        }}>
          <p style={{ 
            margin: '0 0 5px 0',
            color: isWatching ? '#155724' : '#721c24',
            fontWeight: 'bold'
          }}>
            {isWatching ? '✅ 自动监听已启动' : '❌ 自动监听已停止'}
          </p>
          
          {watcherStatus.project_path && (
            <p style={{ margin: '0 0 5px 0', color: isWatching ? '#155724' : '#721c24' }}>
              <strong>监听目录:</strong> {watcherStatus.project_path}
            </p>
          )}
          
          {watcherStatus.log_file_path && (
            <p style={{ margin: '0 0 5px 0', color: isWatching ? '#155724' : '#721c24' }}>
              <strong>日志文件:</strong> {watcherStatus.log_file_path}
            </p>
          )}
          
          {watcherStatus.last_auto_commit && (
            <p style={{ margin: '0', color: isWatching ? '#155724' : '#721c24' }}>
              <strong>最后提交:</strong> {watcherStatus.last_auto_commit}
            </p>
          )}
        </div>
      )}

      {/* 说明信息 */}
      <div style={{
        marginTop: '15px',
        padding: '10px',
        backgroundColor: '#e7f3ff',
        border: '1px solid #b3d9ff',
        borderRadius: '4px',
        fontSize: '12px',
        color: '#0066cc'
      }}>
        <p style={{ margin: '0 0 5px 0', fontWeight: 'bold' }}>
          💡 使用说明:
        </p>
        <ul style={{ margin: '0', paddingLeft: '20px' }}>
          <li>系统将监听项目文件夹中的所有文件变动</li>
          <li>排除 .git 文件夹内的变动</li>
          <li>文件停止变动后等待指定时间再自动提交</li>
          <li>如果指定了日志文件，将使用其中的最新指令作为提交信息</li>
          <li>否则使用默认提交信息："自动提交：AI 已修改文件"</li>
        </ul>
      </div>
    </div>
  );
};
