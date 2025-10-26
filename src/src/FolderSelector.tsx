import React, { useState } from 'react'
import { open } from '@tauri-apps/plugin-dialog'

interface FolderSelectorProps {
  onFolderSelected: (path: string) => void
  selectedPath?: string
}

export const FolderSelector: React.FC<FolderSelectorProps> = ({ 
  onFolderSelected, 
  selectedPath 
}) => {
  const [isLoading, setIsLoading] = useState(false)

  const selectFolder = async () => {
    setIsLoading(true)
    console.log('开始选择文件夹...')
    try {
      // 使用 Tauri 内置 dialog API 打开文件夹选择对话框
      console.log('调用 open dialog...')
      const selectedPath = await open({
        directory: true,
        title: '选择项目根目录',
        multiple: false,
      })
      
      console.log('Dialog 返回结果:', selectedPath)
      
      if (selectedPath && typeof selectedPath === 'string') {
        onFolderSelected(selectedPath)
        console.log('选择的文件夹路径:', selectedPath)
      } else {
        console.log('用户取消了选择或没有选择文件夹')
      }
    } catch (error) {
      console.error('选择文件夹失败:', error)
      // 如果 dialog API 失败，回退到手动输入方式
      const path = prompt('请输入文件夹路径 (例如: /Users/username/Documents):')
      if (path && path.trim()) {
        onFolderSelected(path.trim())
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div style={{ 
      padding: '20px', 
      border: '1px solid #ddd', 
      borderRadius: '8px',
      margin: '20px',
      backgroundColor: '#f9f9f9'
    }}>
      <h3 style={{ marginTop: 0 }}>文件夹选择器</h3>
      
      <div style={{ marginBottom: '15px' }}>
        <button 
          onClick={selectFolder}
          disabled={isLoading}
          style={{
            padding: '10px 20px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            fontSize: '14px'
          }}
        >
          {isLoading ? '选择中...' : '选择文件夹'}
        </button>
      </div>

      <div style={{ 
        marginBottom: '15px', 
        fontSize: '12px', 
        color: '#666',
        backgroundColor: '#d1ecf1',
        padding: '10px',
        borderRadius: '4px',
        border: '1px solid #bee5eb'
      }}>
        <strong>说明:</strong> 点击按钮将打开系统文件夹选择对话框，选择项目根目录。<br />
        如果对话框无法打开，将回退到手动输入方式。
      </div>

      {selectedPath && (
        <div style={{
          padding: '10px',
          backgroundColor: '#e9ecef',
          borderRadius: '4px',
          fontSize: '12px',
          fontFamily: 'monospace',
          wordBreak: 'break-all'
        }}>
          <strong>已选择路径:</strong><br />
          {selectedPath}
        </div>
      )}
    </div>
  )
}
