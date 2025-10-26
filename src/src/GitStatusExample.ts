/**
 * Git 状态检查示例
 * 使用 Rust 后端调用系统 Git 命令
 */

import { invoke } from '@tauri-apps/api/core';
import { GitService } from './GitService';

// 使用 Rust 后端检查状态
export async function checkGitStatusBackend(repoPath: string): Promise<{
  success: boolean;
  status?: string;
  error?: string;
}> {
  try {
    const result = await invoke<{ status: string; error?: string }>('git_status', { 
      path: repoPath 
    });
    
    if (result.error) {
      return {
        success: false,
        error: result.error
      };
    }
    
    return {
      success: true,
      status: result.status
    };
  } catch (error) {
    return {
      success: false,
      error: `后端调用失败: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

// 使用 GitService 类检查状态
export async function checkGitStatusService(repoPath: string): Promise<{
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

// 统一的 check_git_status 函数
export async function checkGitStatus(repoPath: string): Promise<{
  success: boolean;
  status?: string;
  error?: string;
}> {
  return await checkGitStatusService(repoPath);
}

// 使用示例
export async function exampleUsage() {
  const repoPath = '/path/to/your/git/repo';
  
  console.log('=== 使用 GitService 类 ===');
  const serviceResult = await checkGitStatusService(repoPath);
  console.log('服务结果:', serviceResult);
  
  console.log('=== 直接调用后端 ===');
  const backendResult = await checkGitStatusBackend(repoPath);
  console.log('后端结果:', backendResult);
  
  console.log('=== 统一接口 ===');
  const unifiedResult = await checkGitStatus(repoPath);
  console.log('统一结果:', unifiedResult);
  
  // 比较结果
  console.log('=== 结果比较 ===');
  console.log('服务成功:', serviceResult.success);
  console.log('后端成功:', backendResult.success);
  console.log('统一成功:', unifiedResult.success);
}