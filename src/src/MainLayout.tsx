import React, { useState } from 'react';
import { FolderSelector } from './FolderSelector';
import { AutoWatcher } from './AutoWatcher';
import { SnapshotTimeline } from './SnapshotTimeline';
import { QuickCommitModal } from './QuickCommitModal';
import { SnapshotDetail } from './SnapshotDetail';

interface MainLayoutProps {
  projectPath: string;
  onProjectPathChange: (path: string) => void;
  onSnapshotCreate: (success: boolean, message: string) => void;
  onAutoCommit: (success: boolean, message: string) => void;
  onRollback: (success: boolean, message: string) => void;
}

type TabType = 'snapshots' | 'settings' | 'status';

export const MainLayout: React.FC<MainLayoutProps> = ({
  projectPath,
  onProjectPathChange,
  onSnapshotCreate,
  onAutoCommit,
  onRollback,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('snapshots');
  const [isQuickCommitModalOpen, setIsQuickCommitModalOpen] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<{
    hash: string;
    date: string;
    message: string;
  } | null>(null);

  const tabs = [
    { id: 'snapshots' as TabType, label: '📸 快照管理', icon: '📸' },
    { id: 'settings' as TabType, label: '⚙️ 自动监听', icon: '⚙️' },
    { id: 'status' as TabType, label: '📊 项目状态', icon: '📊' },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'snapshots':
        return (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {projectPath ? (
              <div style={{ 
                display: 'flex', 
                height: '100%',
                gap: '20px',
                padding: '20px'
              }}>
                {/* 左侧栏：快照历史列表 */}
                <div style={{
                  width: '30%',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '8px',
                  padding: '20px',
                  border: '1px solid #dee2e6',
                  overflowY: 'auto',
                  maxHeight: 'calc(100vh - 120px)'
                }}>
                  <h3 style={{
                    margin: '0 0 20px 0',
                    fontSize: '18px',
                    color: '#495057',
                    borderBottom: '2px solid #007bff',
                    paddingBottom: '10px'
                  }}>
                    📸 快照历史
                  </h3>
                  <SnapshotTimeline 
                    projectPath={projectPath} 
                    onRollback={onRollback}
                    onSnapshotSelect={setSelectedSnapshot}
                  />
                </div>

                {/* 右侧栏：快照详情和回退操作 */}
                <div style={{
                  width: '70%',
                  backgroundColor: '#ffffff',
                  borderRadius: '8px',
                  padding: '20px',
                  border: '1px solid #dee2e6',
                  overflowY: 'auto',
                  maxHeight: 'calc(100vh - 120px)'
                }}>
                  <h3 style={{
                    margin: '0 0 20px 0',
                    fontSize: '18px',
                    color: '#495057',
                    borderBottom: '2px solid #28a745',
                    paddingBottom: '10px'
                  }}>
                    📊 快照详情
                  </h3>
                  
                  <SnapshotDetail
                    selectedSnapshot={selectedSnapshot}
                    projectPath={projectPath}
                    onRollback={onRollback}
                  />
                </div>
              </div>
            ) : (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100%',
                padding: '40px'
              }}>
                <FolderSelector onFolderSelected={onProjectPathChange} />
              </div>
            )}
          </div>
        );

      case 'settings':
        return (
          <div style={{
            height: '100%',
            padding: '20px',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            margin: '20px',
            overflowY: 'auto',
            maxHeight: 'calc(100vh - 120px)'
          }}>
            <h3 style={{
              margin: '0 0 20px 0',
              fontSize: '18px',
              color: '#495057',
              borderBottom: '2px solid #ffc107',
              paddingBottom: '10px'
            }}>
              ⚙️ 自动监听设置
            </h3>
            <AutoWatcher 
              projectPath={projectPath} 
              onAutoCommit={onAutoCommit}
            />
          </div>
        );

      case 'status':
        return (
          <div style={{
            height: '100%',
            padding: '20px',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            margin: '20px',
            overflowY: 'auto',
            maxHeight: 'calc(100vh - 120px)'
          }}>
            <h3 style={{
              margin: '0 0 20px 0',
              fontSize: '18px',
              color: '#495057',
              borderBottom: '2px solid #17a2b8',
              paddingBottom: '10px'
            }}>
              📊 项目状态
            </h3>
            
            {projectPath ? (
              <div style={{
                backgroundColor: '#ffffff',
                padding: '20px',
                borderRadius: '8px',
                border: '1px solid #dee2e6'
              }}>
                <div style={{ marginBottom: '15px' }}>
                  <strong style={{ color: '#495057' }}>📁 项目路径:</strong>
                  <div style={{
                    marginTop: '5px',
                    padding: '10px',
                    backgroundColor: '#e9ecef',
                    borderRadius: '4px',
                    fontFamily: 'monospace',
                    fontSize: '14px',
                    wordBreak: 'break-all'
                  }}>
                    {projectPath}
                  </div>
                </div>
                
                <div style={{ marginBottom: '15px' }}>
                  <strong style={{ color: '#495057' }}>🔗 Git 状态:</strong>
                  <div style={{
                    marginTop: '5px',
                    padding: '10px',
                    backgroundColor: '#d4edda',
                    borderRadius: '4px',
                    color: '#155724',
                    fontSize: '14px'
                  }}>
                    ✅ Git 仓库已初始化并准备就绪
                  </div>
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <strong style={{ color: '#495057' }}>📸 快照功能:</strong>
                  <div style={{
                    marginTop: '5px',
                    padding: '10px',
                    backgroundColor: '#d1ecf1',
                    borderRadius: '4px',
                    color: '#0c5460',
                    fontSize: '14px'
                  }}>
                    ✅ 快照创建和回退功能已激活
                  </div>
                </div>

                <div>
                  <strong style={{ color: '#495057' }}>⚙️ 自动监听:</strong>
                  <div style={{
                    marginTop: '5px',
                    padding: '10px',
                    backgroundColor: '#fff3cd',
                    borderRadius: '4px',
                    color: '#856404',
                    fontSize: '14px'
                  }}>
                    ⚠️ 请在"自动监听"标签页中配置监听设置
                  </div>
                </div>
              </div>
            ) : (
              <div style={{
                backgroundColor: '#ffffff',
                padding: '20px',
                borderRadius: '8px',
                border: '1px solid #dee2e6',
                textAlign: 'center'
              }}>
                <div style={{
                  fontSize: '16px',
                  color: '#6c757d',
                  marginBottom: '10px'
                }}>
                  📁 请先选择项目路径
                </div>
                <div style={{
                  fontSize: '14px',
                  color: '#6c757d'
                }}>
                  在"快照管理"标签页中选择项目目录以开始使用
                </div>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#ffffff'
    }}>
      {/* 顶部导航栏 */}
      <div style={{
        backgroundColor: '#ffffff',
        borderBottom: '2px solid #e9ecef',
        padding: '0 20px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '60px'
        }}>
          {/* 应用标题 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            fontSize: '20px',
            fontWeight: 'bold',
            color: '#495057'
          }}>
            <span style={{ marginRight: '10px' }}>📸</span>
            VibeSnap
          </div>

          {/* Tab 导航 */}
          <div style={{
            display: 'flex',
            gap: '0'
          }}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '12px 20px',
                  border: 'none',
                  backgroundColor: activeTab === tab.id ? '#007bff' : 'transparent',
                  color: activeTab === tab.id ? '#ffffff' : '#495057',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: activeTab === tab.id ? 'bold' : 'normal',
                  borderRadius: '6px 6px 0 0',
                  borderBottom: activeTab === tab.id ? '3px solid #0056b3' : '3px solid transparent',
                  transition: 'all 0.2s ease',
                  marginRight: '2px'
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== tab.id) {
                    e.currentTarget.style.backgroundColor = '#f8f9fa';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== tab.id) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <span style={{ marginRight: '8px' }}>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* 手动提交按钮 */}
          {projectPath && (
            <button
              onClick={() => setIsQuickCommitModalOpen(true)}
              style={{
                padding: '10px 20px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
                transition: 'background-color 0.2s ease',
                marginLeft: '20px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#218838';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#28a745';
              }}
            >
              💾 手动提交
            </button>
          )}
        </div>
      </div>

      {/* 主内容区域 */}
      <div style={{
        flex: 1,
        overflow: 'hidden',
        backgroundColor: '#f8f9fa'
      }}>
        {renderTabContent()}
      </div>

      {/* 手动提交模态对话框 */}
      <QuickCommitModal
        isOpen={isQuickCommitModalOpen}
        projectPath={projectPath}
        onClose={() => setIsQuickCommitModalOpen(false)}
        onCommit={onSnapshotCreate}
      />
    </div>
  );
};

