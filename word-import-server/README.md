# Word Import Server

Convert `.docx` files to HTML with images kept inline as base64 data URLs.



## Run

```bash
cd word-import-server
npm install
npm start
```



Optional env vars:
- `PORT`: server port (default `8787`)
- `DB_PATH`: absolute path to local SQLite file (default `../football_news.db` in project root)

## API

`POST /api/word/convert` with multipart/form-data field `file`.

Response:
- `html`: converted HTML with inline images
- `plainText`: stripped text version
- `suggestedTitle`: first words from document
- `warnings`: mammoth conversion warnings


