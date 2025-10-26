import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ConfirmDialog } from './ConfirmDialog';

interface SnapshotDetailProps {
  selectedSnapshot: {
    hash: string;
    date: string;
    message: string;
  } | null;
  projectPath: string;
  onRollback: (success: boolean, message: string) => void;
}

interface SnapshotDiff {
  success: boolean;
  files: string[];
  error?: string;
}

interface FriendlyDiffLine {
  content: string;
  change_type: string; // "added", "removed", "unchanged"
  line_number?: number;
}

interface FriendlyDiffContent {
  success: boolean;
  summary?: string;
  lines: FriendlyDiffLine[];
  error?: string;
}

export const SnapshotDetail: React.FC<SnapshotDetailProps> = ({
  selectedSnapshot,
  projectPath,
  onRollback
}) => {
  const [snapshotFiles, setSnapshotFiles] = useState<string[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [friendlyDiffContents, setFriendlyDiffContents] = useState<Record<string, FriendlyDiffContent>>({});
  const [loadingFriendlyDiff, setLoadingFriendlyDiff] = useState<string | null>(null);
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // 当选中快照改变时，获取文件列表
  useEffect(() => {
    if (selectedSnapshot && projectPath) {
      fetchSnapshotFiles(selectedSnapshot.hash);
    } else {
      setSnapshotFiles([]);
      setFriendlyDiffContents({});
      setExpandedFile(null);
    }
  }, [selectedSnapshot, projectPath]);

  // 获取快照修改的文件列表
  const fetchSnapshotFiles = async (hash: string) => {
    if (!projectPath) return;

    setLoadingFiles(true);
    try {
      const result = await invoke<SnapshotDiff>('get_snapshot_diff', {
        projectPath: projectPath,
        hash: hash
      });

      if (result.success) {
        setSnapshotFiles(result.files);
      } else {
        console.error('获取快照文件列表失败:', result.error);
        setSnapshotFiles([]);
      }
    } catch (err) {
      console.error('获取快照文件列表错误:', err);
      setSnapshotFiles([]);
    } finally {
      setLoadingFiles(false);
    }
  };

  // 获取用户友好的文件差异内容
  const fetchFriendlyDiffContent = async (hash: string, filePath: string) => {
    if (!projectPath) return;

    setLoadingFriendlyDiff(filePath);
    try {
      const result = await invoke<FriendlyDiffContent>('get_friendly_diff_content', {
        projectPath: projectPath,
        hash: hash,
        filePath: filePath
      });

      if (result.success) {
        setFriendlyDiffContents(prev => ({
          ...prev,
          [filePath]: result
        }));
      } else {
        console.error('获取用户友好差异失败:', result.error);
      }
    } catch (err) {
      console.error('获取用户友好差异错误:', err);
    } finally {
      setLoadingFriendlyDiff(null);
    }
  };

  // 切换文件差异展开状态
  const toggleFileDiffExpansion = (filePath: string) => {
    if (expandedFile === filePath) {
      setExpandedFile(null);
    } else {
      setExpandedFile(filePath);
      // 如果还没有加载过这个文件的用户友好差异，则加载
      if (!friendlyDiffContents[filePath] && selectedSnapshot) {
        fetchFriendlyDiffContent(selectedSnapshot.hash, filePath);
      }
    }
  };

  // 格式化用户友好的差异内容
  const formatFriendlyDiffContent = (friendlyDiff: FriendlyDiffContent) => {
    return friendlyDiff.lines.map((line, index) => {
      let style: React.CSSProperties = {
        fontFamily: 'monospace',
        fontSize: '12px',
        lineHeight: '1.4',
        padding: '8px 12px',
        margin: '1px 0',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
        display: 'flex',
        alignItems: 'center'
      };

      // 根据变化类型设置样式
      if (line.change_type === 'added') {
        style.backgroundColor = '#d4edda';
        style.color = '#155724';
        style.borderLeft = '4px solid #28a745';
      } else if (line.change_type === 'removed') {
        style.backgroundColor = '#f8d7da';
        style.color = '#721c24';
        style.borderLeft = '4px solid #dc3545';
      } else {
        style.backgroundColor = '#f8f9fa';
        style.color = '#495057';
        style.borderLeft = '4px solid #6c757d';
      }

      return (
        <div key={index} style={style}>
          {line.line_number && (
            <span style={{
              marginRight: '12px',
              fontSize: '10px',
              color: '#6c757d',
              minWidth: '30px',
              textAlign: 'right'
            }}>
              {line.line_number}
            </span>
          )}
          <span style={{ flex: 1 }}>
            {line.content}
          </span>
        </div>
      );
    });
  };

  // 处理回退操作
  const handleRollback = () => {
    if (selectedSnapshot) {
      setShowConfirmDialog(true);
    }
  };

  const confirmRollback = async () => {
    if (!selectedSnapshot) return;
    
    setShowConfirmDialog(false);
    try {
      const result = await invoke<{
        success: boolean;
        message: string;
        error?: string;
      }>('rollback', {
        projectPath: projectPath,
        hash: selectedSnapshot.hash
      });

      if (result.success) {
        onRollback(true, `✅ 代码已成功回退到版本 ${selectedSnapshot.hash.substring(0, 7)}！`);
        // 清空选中状态 - 这个功能应该在父组件中处理
        // setSelectedSnapshot(null);
      } else {
        onRollback(false, result.message || '回退失败');
      }
    } catch (error) {
      onRollback(false, `回退失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const cancelRollback = () => {
    setShowConfirmDialog(false);
  };

  // 默认状态
  if (!selectedSnapshot) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '200px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        border: '2px dashed #dee2e6',
        color: '#6c757d',
        fontSize: '16px',
        textAlign: 'center',
        padding: '20px'
      }}>
        <div>
          <div style={{ fontSize: '48px', marginBottom: '15px' }}>📸</div>
          <div>请在左侧选择一个快照</div>
          <div style={{ fontSize: '14px', marginTop: '8px' }}>
            以查看其修改详情和回退选项
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* 快照信息头部 */}
      <div style={{
        backgroundColor: '#e7f3ff',
        padding: '15px',
        borderRadius: '8px',
        marginBottom: '20px',
        border: '1px solid #b3d9ff'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '10px'
        }}>
          <div>
            <span style={{
              backgroundColor: '#007bff',
              color: 'white',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 'bold',
              fontFamily: 'monospace',
              marginRight: '10px'
            }}>
              {selectedSnapshot.hash.substring(0, 7)}
            </span>
            <span style={{
              fontSize: '14px',
              color: '#495057',
              fontFamily: 'monospace'
            }}>
              {selectedSnapshot.date}
            </span>
          </div>
          
          <button
            onClick={handleRollback}
            style={{
              padding: '8px 16px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              transition: 'background-color 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#c82333';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#dc3545';
            }}
          >
            🔄 回到此版本
          </button>
        </div>
        
        <div style={{
          fontSize: '14px',
          color: '#495057',
          lineHeight: '1.4',
          wordBreak: 'break-word'
        }}>
          {selectedSnapshot.message}
        </div>
      </div>

      {/* 修改的文件列表 */}
      <div style={{
        backgroundColor: '#ffffff',
        border: '1px solid #dee2e6',
        borderRadius: '8px',
        overflow: 'hidden',
        marginBottom: '20px'
      }}>
        <div style={{
          padding: '12px 16px',
          backgroundColor: '#f8f9fa',
          borderBottom: '1px solid #dee2e6',
          fontSize: '14px',
          fontWeight: 'bold',
          color: '#495057'
        }}>
          📁 修改的文件 ({snapshotFiles.length})
        </div>
        
        {loadingFiles ? (
          <div style={{
            padding: '20px',
            textAlign: 'center',
            color: '#6c757d'
          }}>
            🔄 加载文件列表中...
          </div>
        ) : snapshotFiles.length > 0 ? (
          <div>
            {snapshotFiles.map((file, index) => (
              <div key={file}>
                {/* 文件项 */}
                <div
                  style={{
                    padding: '12px 16px',
                    borderBottom: index < snapshotFiles.length - 1 ? '1px solid #dee2e6' : 'none',
                    backgroundColor: 'white',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s ease'
                  }}
                  onClick={() => toggleFileDiffExpansion(file)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f8f9fa';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'white';
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span style={{
                      fontSize: '13px',
                      color: '#495057',
                      fontFamily: 'monospace',
                      wordBreak: 'break-all'
                    }}>
                      {file}
                    </span>
                    <span style={{
                      fontSize: '12px',
                      color: '#6c757d'
                    }}>
                      {expandedFile === file ? '▼' : '▶'} 查看差异
                    </span>
                  </div>
                </div>

                {/* 文件差异预览 */}
                {expandedFile === file && (
                  <div style={{
                    backgroundColor: '#f8f9fa',
                    borderTop: '1px solid #dee2e6'
                  }}>
                    <div style={{
                      padding: '8px 12px',
                      backgroundColor: '#f8f9fa',
                      borderBottom: '1px solid #dee2e6',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      color: '#495057'
                    }}>
                      📊 代码差异预览: {file}
                    </div>
                    
                    {loadingFriendlyDiff === file ? (
                      <div style={{
                        padding: '20px',
                        textAlign: 'center',
                        color: '#6c757d'
                      }}>
                        🔄 加载差异内容中...
                      </div>
                    ) : friendlyDiffContents[file] ? (
                      <div>
                        {/* 自然语言摘要 */}
                        {friendlyDiffContents[file].summary && (
                          <div style={{
                            padding: '12px',
                            backgroundColor: '#e7f3ff',
                            borderBottom: '1px solid #b3d9ff',
                            fontSize: '13px',
                            color: '#0066cc',
                            fontStyle: 'italic'
                          }}>
                            💡 {friendlyDiffContents[file].summary}
                          </div>
                        )}
                        
                        {/* 差异内容 */}
                        <div style={{
                          maxHeight: '300px',
                          overflowY: 'auto'
                        }}>
                          {formatFriendlyDiffContent(friendlyDiffContents[file])}
                        </div>
                      </div>
                    ) : (
                      <div style={{
                        padding: '20px',
                        textAlign: 'center',
                        color: '#dc3545',
                        fontSize: '12px'
                      }}>
                        ❌ 无法加载差异内容
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            padding: '20px',
            textAlign: 'center',
            color: '#6c757d'
          }}>
            📝 此快照未修改任何文件
          </div>
        )}
      </div>

      {/* 确认对话框 */}
      <ConfirmDialog
        isOpen={showConfirmDialog}
        title="严重警告：不可逆操作！"
        message={`回退操作将永久删除当前未保存的修改，并将项目文件恢复到 ${selectedSnapshot.hash.substring(0, 7)} 时的状态。您确定继续吗？`}
        confirmText="确认回退"
        cancelText="取消"
        onConfirm={confirmRollback}
        onCancel={cancelRollback}
      />
    </div>
  );
};
