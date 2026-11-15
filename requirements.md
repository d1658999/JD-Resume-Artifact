要求:

1. 求職者給一個求職網站，根據job description給求職者知道需要哪些技能，中英文版都要，因為可能有機會是外商
2. 假如求職者给求職網站+自己履歷，則AI會根據求職網站內容給求職者建議與履歷需要修改的地方並且針對細項給評分，中英文版都要
3. 若求職者對職缺有興趣 利用AI會給求職者模擬10到15題筆試或面試可能會出的問題 
4. 需要有註冊登入流程email,password,name,gender 註冊時，要有一個驗證碼，輸入`job888`，輸入正確驗證碼才能註冊
5. 要有landing page 明亮且高品質的設計樣式
6. 註冊完後 會有一個mentor 帶領你怎麼做 如果是男的註冊則是用女的mentor頭像, 女的註冊則是用男的mentor頭像. 頭像要日本2次元的漫畫看起來很專業的風格
7. 登入後可以保持登入狀態（cookie）一天
8. API key存在本地端localstorage不會因為重新整理就消失，除非新調cookie。旁邊要有一句話說明我們不會保存它。
9. 使用者前端上傳履歷，支援PDF/Docx/google docs公開連結/notion公開連結，藉由我們的api，並且將檔案存到vercel blob，最後將ai結果以及vercel blob檔案連結都存到mongodb，會使用mongoose，環境變數我都放到.env.local裡面了
10. User model需要新增一個使用者身份的欄位，有管理者和一般使用者，然後我要一個後台能管理全部資料，目前只讓`pricewu168@gmail.com` 這個使用者成為管理者，其他還是一般使用者
11. 註冊 API：bcrypt 加密密碼後存入 MongoDB，登入 API：比對密碼 → 建立 JWT → 存入 HTTP-only Cookie，註冊 → 登出 → 登入 → 重新整理仍保持登入狀態

AI KEYS:
1. 使用者要提供自己的金鑰
2. 支援OPENAI, GEMINI, OLLAMA 的API KEY
3. AI MODEL使用:
	a. OPENAI -> gpt-6-luna
	b. gemini -> gemini-3.8-flash
	c. ollama cloud -> deepseek-v4.1-flash:1017 
	
env.local:
1. 有三家的api key: OPENAI -> openai_key, GEMINI -> gemini_key, OLLAMA -> ollama_key
2. vercel blob的環境參數是 BLOB_STORE_ID, BLOB_READ_WRITE_TOKEN
3. MONGODB的URL是 MONGODB_URI