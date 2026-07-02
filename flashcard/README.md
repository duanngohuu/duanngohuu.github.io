# Flashcard Google Sheets

App flashcard cá nhân chạy trên GitHub Pages, đọc data từ Google Sheets bằng OAuth readonly.

## URL sau khi deploy

Vì repo là `duanngohuu/duanngohuu.github.io`, app nằm ở thư mục `/flashcard`.

```text
https://duanngohuu.github.io/flashcard/
```

## Tính năng

- Chạy static 100% trên GitHub Pages.
- Đọc Google Sheet private bằng OAuth.
- Scope chỉ đọc: `https://www.googleapis.com/auth/spreadsheets.readonly`.
- Không lưu access token vào localStorage.
- Lưu cấu hình và tiến độ học trên trình duyệt bằng localStorage.
- Mobile-first, dùng ổn trên iPhone.
- Chọn deck/tag/search/range/số lượng/shuffle.
- Flashcard 3 mặt: từ → nghĩa → ví dụ.
- Mark `Biết rồi` / `Chưa nhớ`.
- Ôn lại thẻ chưa nhớ.
- Export progress JSON.

## Format Google Sheet

Tạo một Google Sheet, sheet name ví dụ `vocab`, hàng đầu tiên là header:

```csv
id,deck,front,reading,meaning_vi,meaning_jp,example_jp,example_vi,tags,note
```

Ví dụ:

```csv
1,Business Japanese,確認,かくにん,xác nhận,内容や状態をたしかめること,資料の内容をご確認いただけますでしょうか。,Anh/chị có thể xác nhận nội dung tài liệu giúp tôi được không?,"business,mail,n2",ご確認ください = lịch sự
```

Trong app nhập range:

```text
vocab!A1:J
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
8. Copy Spreadsheet ID từ URL Google Sheet.

Ví dụ URL:

```text
https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit#gid=0
```

## Cách dùng

1. Mở `https://duanngohuu.github.io/flashcard/`.
2. Nhập OAuth Client ID.
3. Nhập Spreadsheet ID.
4. Nhập range, ví dụ `vocab!A1:J`.
5. Bấm `Lưu cấu hình`.
6. Bấm `Kết nối Google`.
7. Chọn deck/tag/range/số lượng.
8. Bấm `Bắt đầu học`.

## Bảo mật

- OAuth Client ID không phải secret, có thể public trong frontend.
- Không đặt Client Secret vào GitHub Pages.
- Access token chỉ giữ trong memory của tab hiện tại.
- Chỉ dùng Sheets readonly scope.
- Nếu data không private thì có thể dùng Google Sheet publish CSV, nhưng hướng OAuth an toàn hơn cho file cá nhân.

## Phím tắt

- Space: lật thẻ.
- ArrowRight: thẻ tiếp theo.
- ArrowLeft: thẻ trước.
- K: biết rồi.
- A: chưa nhớ.
