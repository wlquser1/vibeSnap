#!/bin/bash

# VibeSnap 开发环境启动脚本
echo "🚀 启动 VibeSnap 开发环境..."

# 清理之前的进程
echo "🧹 清理之前的进程..."
pkill -f "tauri dev" 2>/dev/null
pkill -f "npm run dev" 2>/dev/null
pkill -f "vite" 2>/dev/null

# 等待端口释放
sleep 2

# 检查依赖是否安装
echo "📦 检查依赖..."
if [ ! -d "src/node_modules" ]; then
    echo "⚠️  前端依赖未安装，正在安装..."
    cd src && npm install && cd ..
fi

if [ ! -d "node_modules" ]; then
    echo "⚠️  根目录依赖未安装，正在安装..."
    npm install
fi

# 启动前端开发服务器
echo "🌐 启动前端开发服务器..."
cd src && npm run dev &
FRONTEND_PID=$!

# 等待前端服务器启动
echo "⏳ 等待前端服务器启动..."
for i in {1..30}; do
    if curl -s http://localhost:5173 > /dev/null 2>&1; then
        echo "✅ 前端服务器已启动！访问地址: http://localhost:5173"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ 前端服务器启动超时"
        kill $FRONTEND_PID 2>/dev/null
        exit 1
    fi
    sleep 1
done

# 启动 Tauri 开发服务器
echo "🖥️  启动 Tauri 桌面应用..."
cd .. && npm run dev &
TAURI_PID=$!

# 等待用户中断
echo ""
echo "🎉 开发环境已启动！"
echo "📱 前端地址: http://localhost:5173"
echo "🖥️  Tauri 桌面应用应该已经打开"
echo ""
echo "按 Ctrl+C 停止所有服务..."

# 捕获中断信号
trap 'echo ""; echo "🛑 正在停止服务..."; kill $FRONTEND_PID 2>/dev/null; kill $TAURI_PID 2>/dev/null; echo "✅ 服务已停止"; exit 0' INT

# 等待进程
wait $TAURI_PID