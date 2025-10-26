import { useState } from 'react'
import { MainLayout } from './MainLayout'
import { invoke } from '@tauri-apps/api/core'
import './App.css'

function App() {
  const [selectedFolderPath, setSelectedFolderPath] = useState<string>('')

  const handleFolderSelected = async (path: string) => {
    setSelectedFolderPath(path)
    console.log('选择的文件夹路径:', path)
    
    // 自动执行 Git 初始化
    try {
      const result = await invoke<{
        success: boolean;
        message: string;
        was_initialized: boolean;
        error?: string;
      }>('ensure_git_repo', { projectPath: path })
      
      console.log('Git 初始化结果:', result)
    } catch (error) {
      console.error('Git 初始化失败:', error)
    }
  }

  const handleSnapshotCreate = (success: boolean, message: string) => {
    console.log('快照创建结果:', { success, message })
  }

  const handleAutoCommit = (success: boolean, message: string) => {
    console.log('自动提交结果:', { success, message })
  }

  const handleRollback = (success: boolean, message: string) => {
    console.log('回退结果:', { success, message })
  }

  return (
    <MainLayout
      projectPath={selectedFolderPath}
      onProjectPathChange={handleFolderSelected}
      onSnapshotCreate={handleSnapshotCreate}
      onAutoCommit={handleAutoCommit}
      onRollback={handleRollback}
    />
  )
}

export default App
