# 龙心 · 手机阅读测试版

仅内置功能说明，不包含原作正文。TXT、草稿和备份导入均只保存在当前浏览器；本版无云端同步、无离线缓存。

## 网页上传与发布

1. 解压本压缩包。进入 GitHub 仓库，选择 uploading an existing file（上传现有文件）。
2. 把解压后的文件和 assets、source 文件夹一起拖入；index.html 必须直接在仓库根目录，不能多套一层文件夹。提交到 main。
3. 打开仓库 Settings → Pages，Source 选择 Deploy from a branch，Branch 选择 main，目录选择 / (root)，点击 Save。
4. 等 GitHub 完成 Pages 部署后，打开 Pages 页面显示的真实网址，再用手机测试。

## 维护源代码

source/ 保存源码，assets/ 和根目录 index.html 是已构建成品。需要 Node.js 22.13 或更新版本。运行 npm install，然后 npm run build，输出在 build-output/；更新网站时将该目录内容复制到仓库根目录。

## 测试范围

检查手机访问、左右翻页、字号、行距、纸色和同一浏览器中的进度恢复。删除网站数据可能导致本机文章丢失，请保留原稿并定期导出备份。
