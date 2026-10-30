# Thuật toán smart object kiểu Photoshop (bản 3)

Engine dựng lại cách Photoshop đặt ảnh vào smart object và ghép layer. Mỗi quy tắc dưới đây đều đã được đối chiếu với
ảnh do chính Photoshop render. Code tương ứng nằm trong `lib/mockup-engine/`.

```
ảnh thiết kế ──(1) đặt vào khung nội dung──▶ nội dung SO (W×H, vd 4200×4800 @300 DPI)
             ──(2) hình học + lấy mẫu──▶ raster SO trên canvas ──(3) smart filter
             ──(4) ghép layer: mask, clipping, group, adjustment, blend mode──▶ ảnh mockup
```

## 0. So với bản 2: đã sửa những gì

Đối chiếu với file `T-Shirt_Mockup_S.psd` do Photoshop 23.5 lưu, tôi tìm ra hai chỗ bản 2 sai:

| | Bản 2 | Bản 3 (đúng như Photoshop) | Sai số so với Photoshop |
|---|---|---|---|
| **Clipping** (layer Multiply/Screen clip vào SO) | ghép kiểu *source-atop* W3C | trộn thẳng vào màu layer gốc, giống vẽ lên layer đã khoá trong suốt (mục 4.3) | ở pixel bán trong suốt: 10.9 → **0.30**/255 (max 36.7 → 1.3) |
| **Lấy mẫu SO khi có warp** | lọc diện tích + song tuyến 3×3 | **bicubic Catmull-Rom trên nội dung độ phân giải gốc**, 1 mẫu/pixel (mục 2.4) | alpha 3.66 → **0.15**; vùng SO MAE 1.32 → **0.055** |

Ngoài ra bản 3 bổ sung các phần sau. Tất cả đều đã kiểm chứng (mục 6):

- Adjustment layer.
- Smart filter Gaussian Blur và Curves/Levels.
- Group Pass Through có fill, và group Pass Through làm gốc clipping.
- Dùng vector mask do Photoshop đã raster hoá sẵn.
- Shape có stroke.
- Layer trống vẫn được giữ lại, vì nó làm thay đổi clipping.
- Hai chỗ lệch nhỏ của Vivid Light / Hard Mix so với công thức tài liệu.
- PSD 16-bit và 32-bit.
- Nội dung SO lồng nhau.

## 1. Đặt ảnh vào khung nội dung

- Template và mockup dùng chung **khung nội dung** (`Sz` + `Rslt` của SO). Ảnh luôn được đặt vào khung này, không đặt vào canvas.
  Engine ghép slot giữa hai file theo **tên file nội dung**. Nếu cùng tên mà khác kích thước thì tách thành slot `#2`.
- Cách đặt có hai kiểu:
  - `fit`: `contain` / `cover` / `stretch` / `none`, kèm `align`, `scale`, `offsetX/Y`.
  - `rect` chính xác, tính bằng px của khung.
- Phần ảnh nằm ngoài khung bị cắt bỏ, giống Photoshop: nội dung SO chỉ có W×H.
- DPI in = `rộng ảnh (px) / (rộng sau khi đặt (px nội dung) / DPI khung)`.

### 1.1 Mockup "cửa sổ in" (`printWindow`, ngoài Photoshop)

Một số mockup cũ dùng smart object warp rất mạnh và chỉ mở một ô nhỏ qua mask (vd 558×499 trên khung 3613×3061). Replace Contents
trên các file này cho hình nghiêng và bị cắt. Khi bật `printWindow` và mask (của layer hoặc gốc clipping) chiếm dưới 50% khung bao
của `quad`, engine thay hình học bằng phép đặt thẳng vào khung mask; mask, clipping, blend mode và các layer phía trên giữ nguyên.
Mockup khác không đổi. Tắt mặc định, nên `validate` vẫn đo đúng theo Photoshop.

### 1.2 Giữ màu hình in khi đổi màu sản phẩm (`printBase`, ngoài Photoshop)

Smart object blend Linear Burn/Multiply tối theo màu áo, nên trên áo đen hình in gần như biến mất. Khi truyền `printBase`, phần hình
in phủ tới lấy theo bản render với sản phẩm chưa nhuộm (`lerp(kết_quả, bản_chưa_nhuộm, α·mask)`); nếp vải từ các layer phía trên vẫn giữ.

## 2. Hình học

### 2.1 Chuẩn hoá mọi loại warp về một lưới Bezier từng mảnh

| Trong PSD | Lưới |
|---|---|
| không warp / `warpNone` | 1 mảnh, 4×4 đều |
| `warpCustom` (16 điểm) | 1 mảnh |
| `quiltWarp` (Split warp, `deformNumRows × deformNumCols`, `quiltSliceX/Y`) | nX × nY mảnh |
| preset (Arc, Flag, Cylinder…) | chưa hỗ trợ, có cảnh báo. Trong Photoshop đổi sang Custom rồi lưu lại |

### 2.2 Công thức

Với điểm `(x, y)` trong không gian nội dung:

1. Tìm mảnh `(i, j)` chứa điểm và tính tham số cục bộ:
   `s = (x − sliceX[j]) / (sliceX[j+1] − sliceX[j])`, `t` tính tương tự theo trục y.
2. Chuẩn hoá theo **bbox của toàn bộ điểm lưới** (không phải khung W×H): `n = (P − min) / (max − min)`.
3. Chiếu phối cảnh: `C = H(n)`. H là homography biến hình vuông đơn vị thành tứ giác `nonAffineTransform`; nếu không có thì dùng `Trnf`.
   ```
   Σx = x0 − x1 + x2 − x3, Σy = y0 − y1 + y2 − y3, Δx1 = x1 − x2, Δx2 = x3 − x2, Δy1 = y1 − y2, Δy2 = y3 − y2
   g = (Σx·Δy2 − Δx2·Σy)/(Δx1·Δy2 − Δx2·Δy1),  h = (Δx1·Σy − Σx·Δy1)/(Δx1·Δy2 − Δx2·Δy1)
   a = x1 − x0 + g·x1, b = x3 − x0 + h·x3, c = x0;  d = y1 − y0 + g·y1, e = y3 − y0 + h·y3, f = y0
   H(s,t) = ((a·s + b·t + c)/(g·s + h·t + 1), (d·s + e·t + f)/(g·s + h·t + 1))
   ```
4. Mặt Bezier bậc 3, **tính sau khi đã chiếu phối cảnh**:
   `Q = Σa Σb B_a(t)·B_b(s)·C[3i+a][3j+b]`, với `B = (1−t)³, 3t(1−t)², 3t²(1−t), t³`.

Trên file Photoshop thật, công thức này cho nội dung lệch dưới 0.3 px (trung bình khoảng 0.01 px). Nếu dùng khung W×H thay cho bbox
thì hình chỉ khớp 71%. Nếu tính Bezier trước rồi mới chiếu phối cảnh thì nội dung lệch khoảng 11 px.

### 2.3 Raster hoá

- Mỗi mảnh được chia sao cho cạnh tam giác khoảng 2 px trên canvas. Từng tam giác được raster theo tile 128 px, và toạ độ
  texture được nội suy barycentric.
- Lưới được kéo dài ra ngoài mép nội dung khoảng 2.5 texel bằng cách ngoại suy chính đa thức Bezier. Nhờ vậy bộ lọc bicubic
  tạo được mép mềm giống Photoshop.
- Quy ước tâm pixel: canvas tại `px + 0.5`; texel tại `u·W − 0.5`.

### 2.4 Lấy mẫu: Photoshop dùng hai bộ lấy mẫu khác nhau

| Trường hợp | Photoshop làm (đã đo) | Engine |
|---|---|---|
| **Có warp** (lưới khác lưới đều) | Lấy mẫu **bicubic Catmull-Rom (a = −0.5) trực tiếp trên nội dung độ phân giải gốc**, một mẫu tại tâm mỗi pixel, *không lọc chống răng cưa*. | giống hệt |
| **Không warp** (chỉ scale / xoay / phối cảnh) | Lọc trước khi thu nhỏ, kiểu "Bicubic Sharper" | Lanczos3 về đúng tỉ lệ đích rồi bicubic. Lệch 1.5/255 trên ảnh chụp |

Vì Photoshop không khử răng cưa khi warp, hoa văn rất mịn có thể bị răng cưa nhẹ, và Photoshop cũng vậy.
Nếu muốn ảnh mịn hơn Photoshop thì dùng `quality: 'smooth'` (lọc diện tích, 3×3 mẫu/pixel).

## 3. Smart filter

Smart filter được áp **sau** khi đã biến đổi hình học, theo đơn vị px của canvas, và theo thứ tự trong file. Mỗi filter
có opacity riêng.

- **Gaussian Blur:** radius của Photoshop chính là độ lệch chuẩn σ. Kiểm chứng: MAE 0.17.
- **Curves / Levels / Hue-Sat / Exposure / Invert…** dùng chung công thức với adjustment layer. Curves khớp tuyệt đối.
- **Displace:** Photoshop **chỉ lưu đường dẫn** tới file bản đồ, không nhúng nó vào PSD. Vì vậy không thể dựng Displace từ
  riêng file PSD. Engine sẽ cảnh báo.

## 4. Ghép layer

Mọi giá trị nằm trong khoảng 0..1 và đã mã hoá gamma. Photoshop blend trực tiếp trong không gian màu của tài liệu.

### 4.1 Layer thường

```
αs = α_pixel · mask · vectorMask · opacity · fill
αo = αs + αb·(1 − αs);   co = αs(1 − αb)·Cs + αs·αb·B(Cb, Cs) + (1 − αs)·αb·Cb      (co premultiplied)
```

- Có 27 blend mode, mỗi mode đều đã đối chiếu với một file Photoshop riêng (MAE ≤ 0.32).
- Soft Light dùng công thức của Photoshop.
- **Vivid Light:** khi `s = 0` thì cho 0, khi `s = 1` thì cho 1. Ở hai đầu này giá trị s được ưu tiên, khác với Color Burn/Dodge đứng riêng.
- **Hard Mix** = `VividLight_thường(b, s) ≥ 0.5 ? 1 : 0`. Tài liệu ghi "b + s ≥ 1" nhưng Photoshop không làm vậy ở các giá trị biên.
- **8 mode đặc biệt khi Fill < 100%** (Color/Linear Burn, Color/Linear Dodge, Vivid/Linear Light, Hard Mix, Difference):
  trộn theo fill trên kết quả chưa kẹp, kẹp về [0, 1], rồi mới áp opacity. Khớp tuyệt đối trên file mẫu Linear Light, fill 20%.
- **Blend If:** `w(v) = 0 / dốc tuyến tính / 1`, gray = 0.3R + 0.59G + 0.11B. Phần "Underlying" chỉ tác dụng theo độ phủ của nền.

### 4.2 Mask

- **Raster mask:** ngoài khung của mask thì lấy `defaultColor`. `density`: `m' = 1 − d·(1 − m)`. Feather làm mờ Gaussian (xấp xỉ).
- **Vector mask:** ưu tiên **raster do Photoshop đã dựng sẵn** (kênh −2 có cờ `fromVectorData`). Nếu file có cả mask
  người dùng thì mask đó nằm ở kênh −3. Khi không có raster dựng sẵn mới tự raster: làm phẳng Bezier, tô scanline 16 hàng
  con với độ phủ ngang chính xác, kết hợp combine / subtract / intersect / exclude.
- **Shape có stroke:** dùng raster Photoshop lưu sẵn (đã gồm fill, stroke và hình dạng), không áp lại vector mask.

### 4.3 Clipping mask: sửa quan trọng nhất của bản 3

Khi "Blend Clipped Layers as Group" bật (mặc định):

```
S  = α_pixel(gốc) · mask(gốc)                    ← hình dạng layer gốc, cũng là alpha của cả nhóm
Cu = màu layer gốc
với mỗi layer clip L:   Cu ← (1 − αL)·Cu + αL·B(Cu, CL)     ← KHÔNG có thành phần (1 − αb)·CL như W3C
kết quả: (Cu, S) ghép xuống nền bằng mode + opacity của layer GỐC
```

Bản 2 dùng source-atop W3C nên lệch tới 36/255 ở mép chữ hoặc mép ảnh bán trong suốt. Bản 3 lệch tối đa 1.3.

Các trường hợp khác:

- Gốc là **group Pass Through:** các layer con vẫn blend xuyên xuống nền. Gọi R là kết quả đó. Màu riêng của group được
  tách ra bằng `G = (R − (1 − S0)·nền)/S0`, rồi layer clip trộn vào G. Kết quả khớp tuyệt đối.
- **Layer trống** vẫn được giữ, vì nếu nó clip vào một group thì group đó trở thành gốc clipping và cách ghép thay đổi.
- Khi "Blend Clipped Layers as Group" tắt: mỗi layer clip ghép thẳng xuống nền với alpha `αL · S`.

### 4.4 Group

- **Pass Through:** các layer con ghép thẳng lên nền; nếu có opacity hoặc mask thì `lerp(nền, kết_quả, opacity·mask)`.
  Nếu group có Fill < 100% và bên trong có adjustment, adjustment đó **không** xuyên xuống dưới: group được ghép như group cô lập.
- **Mode khác** (kể cả Normal): ghép cô lập rồi blend xuống với alpha `α · mask · opacity · fill`. Group cũng có fill
  (file mockup cũ dùng Multiply với fill 70%).

### 4.5 Adjustment layer

Nguồn màu là `adj(màu nền)` tại chính pixel đó, trộn kiểu "khoá trong suốt" (không làm đổi alpha của nền). Nếu adjustment
clip vào một layer thì nó chỉ tác động lên layer gốc đó.

| Adjustment | Sai số so với Photoshop (MAE / 255) |
|---|---|
| Invert, Threshold, Exposure | 0.000–0.02 |
| Curves, Levels, Posterize | 0.16–0.38 |
| Hue/Saturation (kể cả Colorize, theo dải màu) | 0.3–0.85 |
| Brightness/Contrast cũ (legacy) / mới | 0.05 / 3.0 (bản mới là công thức dựng ngược, chỉ xấp xỉ) |
| Color Balance, Photo Filter, Vibrance, B&W, Channel Mixer, Gradient Map, Selective Color, Color Lookup | chưa hỗ trợ, có cảnh báo |

Công thức adjustment dựa theo bản dựng ngược của psd-tools (MIT).

### 4.6 Tối ưu

- Các layer nằm dưới smart object đầu tiên được ghép một lần rồi cache lại.
- Mỗi lần render chỉ xử lý khung bao quanh các layer phía trên, theo từng hàng pixel.
- Với file của bạn (3000×2000): khoảng 0.6 s/ảnh trên Node khi đã có cache, khoảng 1.2–1.8 s trên trình duyệt (Web Worker). Lần đầu mở mỗi mockup mất tới khoảng 3 s.

## 5. Chưa hỗ trợ (engine cảnh báo khi biên dịch)

- **Layer Style:** đổ bóng, stroke dạng style, overlay, bevel… Shape stroke thì dùng raster có sẵn.
- **Gradient/Pattern fill:** dùng raster Photoshop lưu sẵn, nên không đổi màu được.
- **Adjustment** ngoài bảng ở mục 4.5.
- **Smart filter** ngoài Gaussian Blur và nhóm chỉnh màu. Riêng Displace thì Photoshop không nhúng bản đồ vào PSD.
- **Warp preset.**
- **Knockout, Dissolve,** tắt "Transparency Shapes Layer".
- **PSD 32-bit:** quy đổi tuyến tính → gamma 2.2, chỉ xấp xỉ. **CMYK:** không hỗ trợ.
- **Còn lệch nhỏ:** layer có cả raster mask lẫn vector mask kèm density; path operation lồng trong group; group Pass Through
  có fill < 100% chứa layer blend đặc biệt (lệch khoảng 2/255).

Cách xử lý chung: trong Photoshop, merge hoặc rasterize phần đó vào layer tĩnh trước khi biên dịch.

## 6. Kiểm chứng

| Bộ kiểm tra | Kết quả |
|---|---|
| `T-Shirt_Mockup_S.psd` (Photoshop 23.5, warp 4×4 + Multiply/Screen clip + mask) | ghép layer MAE 0.001; dựng lại SO + ghép MAE 0.003; vùng SO MAE 0.055, IoU 0.9996 |
| Mockup cũ (mockups-design.com: phối cảnh + warp mạnh + Linear Burn + group fill) | dựng lại SO + ghép MAE 0.011–0.015 |
| 125 file PSD do Photoshop lưu (psd-tools + ag-psd): blend mode, clipping, mask, Pass Through, path operation, adjustment, smart object, smart filter, 16/32-bit | **108 file MAE ≤ 0.5, 112 file ≤ 1, trung vị 0.106**. 13 file còn lại đều thuộc các trường hợp đã liệt kê ở mục 5 |

Lệnh chạy lại:

```
npm run validate -- <outDir> <file.psd>…         chi tiết cho từng file (gồm cả hình học SO so với raster Photoshop)
npx tsx scripts/validate-suite.ts <tmp> <psd>…   một dòng cho mỗi file
```
