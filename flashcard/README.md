# Flashcard AI · Google Sheets + Raw Data

App flashcard cá nhân chạy trên GitHub Pages, đọc data từ Google Sheets bằng OAuth readonly hoặc convert raw data ngay trong trình duyệt.

## URL

```text
https://duanngohuu.github.io/flashcard/
```

## Tính năng

- Giao diện glass/gradient/sparkle, mobile-first.
- Menu: `Học`, `Google Sheet`, `Raw Data`, `Hướng dẫn`.
- Đọc Google Sheet private bằng OAuth.
- Scope chỉ đọc: `https://www.googleapis.com/auth/spreadsheets.readonly`.
- Không lưu access token vào localStorage.
- Google Sheet URL tự bóc `Spreadsheet ID`.
- Raw converter hỗ trợ CSV, TSV, JSON, plain text.
- Dùng chung format có dịch Việt: `meaning_vi`, `example_vi`.
- Chọn deck/tag/search/range/số lượng/shuffle.
- Flashcard 3 mặt: từ → nghĩa → ví dụ.
- Mark `Biết rồi` / `Chưa nhớ`.
- Ôn lại thẻ chưa nhớ.
- Export progress JSON và deck JSON.

## Format chuẩn cho Google Sheet và Raw CSV/TSV

Header nên dùng:

```csv
id,deck,front,reading,meaning_vi,meaning_jp,example_jp,example_vi,tags,note
```

Ví dụ:

```csv
1,Business Japanese,確認,かくにん,xác nhận,内容や状態をたしかめること,資料の内容をご確認いただけますでしょうか。,Anh/chị có thể xác nhận nội dung tài liệu giúp tôi được không?,"business,mail,n2",ご確認ください = lịch sự
```

Trong Google Sheet nhập range:

```text
vocab!A1:J
```

## Raw Data

Có thể paste:

### CSV có header

```csv
id,deck,front,reading,meaning_vi,meaning_jp,example_jp,example_vi,tags,note
1,IT Japanese,切り分け,きりわけ,khoanh vùng nguyên nhân,原因や責任範囲を分けて確認すること,原因を切り分けます。,Tôi sẽ khoanh vùng nguyên nhân.,it,障害対応で hay dùng
```

### TSV copy trực tiếp từ Google Sheet/Excel

Copy bảng rồi paste vào Raw Data, chọn `Tự nhận dạng` hoặc `TSV có header`.

### JSON

```json
[
  {
    "id": "1",
    "deck": "Business Japanese",
    "front": "確認",
    "reading": "かくにん",
    "meaning_vi": "xác nhận",
    "meaning_jp": "内容を確かめること",
    "example_jp": "資料をご確認ください。",
    "example_vi": "Vui lòng xác nhận tài liệu.",
    "tags": ["business", "mail"],
    "note": "ご確認ください = lịch sự"
  }
]
```

### Plain text

Mỗi dòng:

```text
front | reading | meaning_vi | example_jp | example_vi | tags
```

Ví dụ:

```text
確認 | かくにん | xác nhận | 資料をご確認ください。 | Vui lòng xác nhận tài liệu. | business,mail
```

## Setup Google Cloud OAuth

1. Vào Google Cloud Console.
2. Tạo project mới.
3. Enable `Google Sheets API`.
4. Tạo OAuth consent screen.
5. Thêm email Google của bạn vào Test users.
6. Tạo OAuth Client ID:
   - Application type: `Web application`
   - Authorized JavaScript origins:
     ```text
     https://duanngohuu.github.io
     ```
7. Copy Client ID vào app.
8. Copy Google Sheet URL hoặc Spreadsheet ID vào app.

Ví dụ URL:

```text
https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit#gid=0
```

## Cách dùng nhanh

1. Mở `https://duanngohuu.github.io/flashcard/`.
2. Muốn dùng raw: vào `Raw Data`, paste data, bấm `Convert & dùng raw`.
3. Muốn dùng Google Sheet: vào `Google Sheet`, nhập Client ID + Sheet URL + Range, bấm `Kết nối Google`.
4. Vào `Học`, chọn deck/tag/range/số lượng.
5. Bấm `Bắt đầu học`.

## Bảo mật

- OAuth Client ID không phải secret, có thể public trong frontend.
- Không đặt Client Secret vào GitHub Pages.
- Access token chỉ giữ trong memory của tab hiện tại.
- Chỉ dùng Sheets readonly scope.
- Raw data được xử lý local trên trình duyệt, không gửi lên server riêng.

## Phím tắt

- Space: lật thẻ.
- ArrowRight: thẻ tiếp theo.
- ArrowLeft: thẻ trước.
- K: biết rồi.
- A: chưa nhớ.
