import React, { useState } from 'react';
import { GitService } from './GitService';
import type { GitStatusInfo } from './GitService';

interface GitStatusCheckerProps {
  folderPath: string;
}

export const GitStatusChecker: React.FC<GitStatusCheckerProps> = ({ folderPath }) => {
  const [gitStatus, setGitStatus] = useState<GitStatusInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [gitInfo, setGitInfo] = useState<any>(null);
  const [commitHistory, setCommitHistory] = useState<string[]>([]);

  // 检查 Git 状态
  const checkGitStatus = async () => {
    if (!folderPath) return;
    
    setLoading(true);
    try {
      const gitService = new GitService(folderPath);
      const status = await gitService.checkGitStatus();
      setGitStatus(status);
    } catch (error) {
      setGitStatus({
        isRepo: false,
        error: `Git 检查失败: ${error instanceof Error ? error.message : String(error)}`
      });
    } finally {
      setLoading(false);
    }
  };

  // 获取 Git 信息
  const getGitInfo = async () => {
    if (!folderPath) return;
    
    setLoading(true);
    try {
      const gitService = new GitService(folderPath);
      const info = await gitService.getGitInfo();
      setGitInfo(info);
    } catch (error) {
      setGitInfo({
        branch: 'unknown',
        commit: 'unknown',
        error: `获取 Git 信息失败: ${error instanceof Error ? error.message : String(error)}`
      });
    } finally {
      setLoading(false);
    }
  };

  // 获取提交历史
  const getCommitHistory = async () => {
    if (!folderPath) return;
    
    setLoading(true);
    try {
      const gitService = new GitService(folderPath);
      const history = await gitService.getCommitHistory(5);
      setCommitHistory(history);
    } catch (error) {
      setCommitHistory([`获取提交历史失败: ${error instanceof Error ? error.message : String(error)}`]);
    } finally {
      setLoading(false);
    }
  };

  // 获取简化状态
  const getSimpleStatus = async () => {
    if (!folderPath) return;
    
    setLoading(true);
    try {
      const gitService = new GitService(folderPath);
      const statusText = await gitService.getSimpleStatus();
      
      setGitStatus({
        isRepo: true,
        status: statusText,
        error: undefined
      });
    } catch (error) {
      setGitStatus({
        isRepo: false,
        error: `获取简化状态失败: ${error instanceof Error ? error.message : String(error)}`
      });
    } finally {
      setLoading(false);
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
      <h3>Git 状态检查</h3>
      
      <div style={{ marginBottom: '15px' }}>
        <button
          onClick={checkGitStatus}
          disabled={loading || !folderPath}
          style={{
            padding: '10px 20px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading || !folderPath ? 'not-allowed' : 'pointer',
            opacity: loading || !folderPath ? 0.6 : 1,
            marginRight: '10px'
          }}
        >
          {loading ? '检查中...' : '检查 Git 状态'}
        </button>
        
        <button
          onClick={getGitInfo}
          disabled={loading || !folderPath}
          style={{
            padding: '10px 20px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading || !folderPath ? 'not-allowed' : 'pointer',
            opacity: loading || !folderPath ? 0.6 : 1,
            marginRight: '10px'
          }}
        >
          获取 Git 信息
        </button>

        <button
          onClick={getCommitHistory}
          disabled={loading || !folderPath}
          style={{
            padding: '10px 20px',
            backgroundColor: '#17a2b8',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading || !folderPath ? 'not-allowed' : 'pointer',
            opacity: loading || !folderPath ? 0.6 : 1,
            marginRight: '10px'
          }}
        >
          获取提交历史
        </button>
        
        <button
          onClick={getSimpleStatus}
          disabled={loading || !folderPath}
          style={{
            padding: '10px 20px',
            backgroundColor: '#6f42c1',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading || !folderPath ? 'not-allowed' : 'pointer',
            opacity: loading || !folderPath ? 0.6 : 1
          }}
        >
          获取简化状态
        </button>
      </div>

      {/* Git 状态显示 */}
      {gitStatus && (
        <div style={{
          padding: '15px',
          backgroundColor: gitStatus.isRepo ? '#d4edda' : '#f8d7da',
          border: `1px solid ${gitStatus.isRepo ? '#c3e6cb' : '#f5c6cb'}`,
          borderRadius: '4px',
          marginTop: '15px'
        }}>
          <h4 style={{ 
            color: gitStatus.isRepo ? '#155724' : '#721c24',
            margin: '0 0 10px 0'
          }}>
            {gitStatus.isRepo ? 'Git 仓库状态' : '错误信息'}
          </h4>
          
          {gitStatus.error ? (
            <p style={{ color: '#721c24', margin: 0 }}>
              {gitStatus.error}
            </p>
          ) : (
            <div>
              {gitStatus.status && (
                <pre style={{ 
                  color: '#155724', 
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'monospace',
                  fontSize: '14px'
                }}>
                  {gitStatus.status}
                </pre>
              )}
            </div>
          )}
        </div>
      )}

      {/* Git 信息显示 */}
      {gitInfo && (
        <div style={{
          padding: '15px',
          backgroundColor: '#d1ecf1',
          border: '1px solid #bee5eb',
          borderRadius: '4px',
          marginTop: '15px'
        }}>
          <h4 style={{ color: '#0c5460', margin: '0 0 10px 0' }}>
            Git 信息
          </h4>
          
          {gitInfo.error ? (
            <p style={{ color: '#721c24', margin: 0 }}>
              {gitInfo.error}
            </p>
          ) : (
            <div style={{ color: '#0c5460' }}>
              <p style={{ margin: '5px 0' }}>
                <strong>分支:</strong> {gitInfo.branch}
              </p>
              <p style={{ margin: '5px 0' }}>
                <strong>最新提交:</strong> {gitInfo.commit}
              </p>
            </div>
          )}
        </div>
      )}

      {/* 提交历史显示 */}
      {commitHistory.length > 0 && (
        <div style={{
          padding: '15px',
          backgroundColor: '#fff3cd',
          border: '1px solid #ffeaa7',
          borderRadius: '4px',
          marginTop: '15px'
        }}>
          <h4 style={{ color: '#856404', margin: '0 0 10px 0' }}>
            最近提交历史
          </h4>
          
          <ul style={{ color: '#856404', margin: 0, paddingLeft: '20px' }}>
            {commitHistory.map((commit, index) => (
              <li key={index} style={{ margin: '5px 0' }}>
                {commit}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};