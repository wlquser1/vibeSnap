import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ConfirmDialog } from './ConfirmDialog';

interface SnapshotHistoryItem {
  hash: string;
  date: string;
  message: string;
}

interface SnapshotHistory {
  success: boolean;
  history: SnapshotHistoryItem[];
  error?: string;
}

interface SnapshotTimelineProps {
  projectPath: string;
  onRollback: (success: boolean, message: string) => void;
  onSnapshotSelect: (snapshot: { hash: string; date: string; message: string }) => void;
}

export const SnapshotTimeline: React.FC<SnapshotTimelineProps> = ({ 
  projectPath, 
  onRollback,
  onSnapshotSelect
}) => {
  const [history, setHistory] = useState<SnapshotHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingRollback, setPendingRollback] = useState<{
    hash: string;
    message: string;
  } | null>(null);
  const [selectedSnapshotHash, setSelectedSnapshotHash] = useState<string | null>(null);

  // 获取历史记录
  const fetchHistory = async () => {
    if (!projectPath) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await invoke<SnapshotHistory>('get_snapshot_history', { 
        projectPath: projectPath 
      });
      
      if (result.success) {
        setHistory(result.history);
      } else {
        setError(result.error || '获取历史记录失败');
      }
    } catch (err) {
      setError(`获取历史记录失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  // 组件加载时获取历史记录
  useEffect(() => {
    fetchHistory();
  }, [projectPath]);

  // 处理回退操作
  const handleRollback = async (hash: string, message: string) => {
    // 设置待回退的信息并显示确认对话框
    setPendingRollback({ hash, message });
    setShowConfirmDialog(true);
  };

  // 确认回退
  const confirmRollback = async () => {
    if (!pendingRollback) return;

    setShowConfirmDialog(false);
    const { hash } = pendingRollback;
    setPendingRollback(null);

    try {
      const result = await invoke<{
        success: boolean;
        message: string;
        error?: string;
      }>('rollback', { 
        projectPath: projectPath,
        hash: hash
      });

      if (result.success) {
        onRollback(true, result.message);
        // 回退成功后刷新历史记录
        await fetchHistory();
      } else {
        onRollback(false, result.message + (result.error ? ` (${result.error})` : ''));
      }
    } catch (err) {
      onRollback(false, `回退失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // 取消回退
  const cancelRollback = () => {
    setShowConfirmDialog(false);
    setPendingRollback(null);
  };

  // 处理快照选择
  const handleSnapshotSelect = (item: SnapshotHistoryItem) => {
    setSelectedSnapshotHash(item.hash);
    onSnapshotSelect({
      hash: item.hash,
      date: item.date,
      message: item.message
    });
  };

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* 刷新按钮 */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'flex-end',
        marginBottom: '15px'
      }}>
        <button
          onClick={fetchHistory}
          disabled={loading || !projectPath}
          style={{
            padding: '6px 12px',
            backgroundColor: loading || !projectPath ? '#6c757d' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading || !projectPath ? 'not-allowed' : 'pointer',
            fontSize: '12px',
            fontWeight: 'bold'
          }}
        >
          {loading ? '🔄' : '🔄'}
        </button>
      </div>

      {error && (
        <div style={{
          padding: '10px',
          backgroundColor: '#f8d7da',
          border: '1px solid #f5c6cb',
          borderRadius: '4px',
          marginBottom: '15px',
          color: '#721c24'
        }}>
          ❌ {error}
        </div>
      )}

      {loading && (
        <div style={{
          padding: '20px',
          textAlign: 'center',
          color: '#6c757d'
        }}>
          🔄 加载历史记录中...
        </div>
      )}

      {!loading && !error && history.length === 0 && (
        <div style={{
          padding: '20px',
          textAlign: 'center',
          color: '#6c757d'
        }}>
          📝 暂无快照记录
        </div>
      )}

      {!loading && !error && history.length > 0 && (
        <div style={{
          flex: 1,
          overflowY: 'auto',
          border: '1px solid #dee2e6',
          borderRadius: '4px'
        }}>
          {history.map((item, index) => (
            <div key={item.hash}>
              {/* 快照卡片 */}
              <div
                style={{
                  padding: '10px',
                  borderBottom: index < history.length - 1 ? '1px solid #dee2e6' : 'none',
                  backgroundColor: selectedSnapshotHash === item.hash ? '#e7f3ff' : (index === 0 ? '#f8f9fa' : 'white'),
                  transition: 'background-color 0.2s ease',
                  cursor: 'pointer',
                  borderLeft: selectedSnapshotHash === item.hash ? '4px solid #007bff' : '4px solid transparent'
                }}
                onClick={() => handleSnapshotSelect(item)}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      marginBottom: '5px'
                    }}>
                      <span style={{
                        backgroundColor: '#007bff',
                        color: 'white',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        fontSize: '10px',
                        fontWeight: 'bold',
                        fontFamily: 'monospace',
                        marginRight: '8px'
                      }}>
                        {item.hash.substring(0, 7)}
                      </span>
                      <span style={{
                        fontSize: '11px',
                        color: '#6c757d',
                        fontFamily: 'monospace'
                      }}>
                        {item.date}
                      </span>
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: '#495057',
                      lineHeight: '1.4',
                      wordBreak: 'break-word',
                      marginBottom: '8px'
                    }}>
                      {item.message}
                    </div>
                  </div>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRollback(item.hash, item.message);
                    }}
                    disabled={!projectPath}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: index === 0 ? '#6c757d' : '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: !projectPath ? 'not-allowed' : 'pointer',
                      opacity: !projectPath ? 0.6 : 1,
                      fontSize: '11px',
                      fontWeight: 'bold',
                      marginLeft: '8px',
                      flexShrink: 0,
                      transition: 'all 0.2s ease'
                    }}
                    title={index === 0 ? '当前版本' : '回退到此版本'}
                  >
                    {index === 0 ? '📍 当前' : '🔄 回退'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 确认对话框 */}
      <ConfirmDialog
        isOpen={showConfirmDialog}
        title="严重警告：不可逆操作！"
        message={`回退操作将永久删除当前未保存的修改，并将项目文件恢复到 ${pendingRollback?.hash} 时的状态。\n\n提交信息：${pendingRollback?.message}\n\n您确定继续吗？`}
        confirmText="确认回退"
        cancelText="取消"
        onConfirm={confirmRollback}
        onCancel={cancelRollback}
      />
    </div>
  );
};
