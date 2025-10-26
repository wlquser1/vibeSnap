/**
 * Git 状态检查服务 - 主要使用 Rust 后端
 * 提供前端接口和错误处理
 */

import { invoke } from '@tauri-apps/api/core';

export interface GitStatusInfo {
  isRepo: boolean;
  branch?: string;
  status?: string;
  error?: string;
}

export interface GitInfo {
  branch: string;
  commit: string;
  error?: string;
}

export class GitService {
  private repoPath: string;

  constructor(repoPath: string) {
    this.repoPath = repoPath;
  }

  /**
   * 检查 Git 状态 - 使用 Rust 后端
   */
  async checkGitStatus(): Promise<GitStatusInfo> {
    try {
      const result = await invoke<{ status: string; error?: string }>('git_status', { 
        path: this.repoPath 
      });
      
      if (result.error) {
        return {
          isRepo: false,
          error: result.error
        };
      }
      
      return {
        isRepo: true,
        status: result.status,
        error: undefined
      };
    } catch (error) {
      return {
        isRepo: false,
        error: `Git 操作失败: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * 获取 Git 信息 - 使用 Rust 后端
   */
  async getGitInfo(): Promise<GitInfo> {
    try {
      const result = await invoke<GitInfo>('git_info', { 
        path: this.repoPath 
      });
      
      return result;
    } catch (error) {
      return {
        branch: 'unknown',
        commit: 'unknown',
        error: `获取 Git 信息失败: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * 获取提交历史 - 使用 Rust 后端
   */
  async getCommitHistory(count: number = 5): Promise<string[]> {
    try {
      const result = await invoke<string[]>('git_log', { 
        path: this.repoPath,
        count: count
      });
      
      return result;
    } catch (error) {
      return [`获取提交历史失败: ${error instanceof Error ? error.message : String(error)}`];
    }
  }

  /**
   * 获取简化的状态信息
   */
  async getSimpleStatus(): Promise<string> {
    try {
      const statusInfo = await this.checkGitStatus();
      
      if (!statusInfo.isRepo) {
        return statusInfo.error || '不是 Git 仓库';
      }

      const gitInfo = await this.getGitInfo();
      
      let statusText = `分支: ${gitInfo.branch}\n`;
      statusText += `最新提交: ${gitInfo.commit}\n`;
      
      if (statusInfo.status) {
        const lines = statusInfo.status.trim().split('\n');
        if (lines.length === 0 || (lines.length === 1 && lines[0] === '')) {
          statusText += '工作区干净，没有变更';
        } else {
          statusText += `有 ${lines.length} 个文件变更`;
        }
      }

      return statusText;
    } catch (error) {
      return `获取 Git 状态失败: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}

// 统一的 check_git_status 函数
export async function checkGitStatus(repoPath: string): Promise<{
  success: boolean;
  status?: string;
  error?: string;
}> {
  try {
    const gitService = new GitService(repoPath);
    const statusInfo = await gitService.checkGitStatus();
    
    if (!statusInfo.isRepo) {
      return {
        success: false,
        error: statusInfo.error || '不是 Git 仓库'
      };
    }
    
    const statusText = await gitService.getSimpleStatus();
    
    return {
      success: true,
      status: statusText
    };
  } catch (error) {
    return {
      success: false,
      error: `Git 检查失败: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}