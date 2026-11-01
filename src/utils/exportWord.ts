import { ExamMatrix, Exam, Question } from '../types';

/**
 * Xuất file Word tài liệu kiểm tra (Ma trận, Bản đặc tả, Đề thi hoặc Đáp án)
 */
export function exportToWordDocument(
  title: string,
  contentHtml: string,
  fileName: string
) {
  const headerHtml = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset='utf-8'>
      <title>${title}</title>
      <style>
        @page {
          size: A4;
          margin: 2cm 2cm 2cm 2.5cm;
          mso-header-margin: 1cm;
          mso-footer-margin: 1cm;
        }
        body {
          font-family: 'Times New Roman', Times, serif;
          font-size: 13pt;
          line-height: 1.35;
          color: #000;
        }
        h1, h2, h3, h4 {
          font-family: 'Times New Roman', Times, serif;
          font-weight: bold;
          text-align: center;
          margin: 10px 0;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 12px 0;
        }
        th, td {
          border: 1px solid #000;
          padding: 6px 8px;
          font-family: 'Times New Roman', Times, serif;
          font-size: 12pt;
          vertical-align: middle;
        }
        th {
          background-color: #f2f2f2;
          font-weight: bold;
          text-align: center;
        }
        .header-table {
          width: 100%;
          border: none;
          margin-bottom: 20px;
        }
        .header-table td {
          border: none;
          padding: 2px 4px;
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .font-bold { font-weight: bold; }
        .italic { font-style: italic; }
      </style>
    </head>
    <body>
      <table class="header-table">
        <tr>
          <td style="width: 45%; text-align: center;">
            <p style="margin: 0; font-size: 11pt;">PHÒNG GD&ĐT HUYỆN TÂY ĐÔ</p>
            <p style="margin: 0; font-weight: bold; font-size: 12pt;">TRƯỜNG THCS TÂY ĐÔ</p>
            <p style="margin: 0; font-size: 11pt;">Giáo viên: <b>Diệp Thanh Toàn</b></p>
          </td>
          <td style="width: 55%; text-align: center;">
            <p style="margin: 0; font-weight: bold; font-size: 12pt;">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
            <p style="margin: 0; font-style: italic; font-size: 11pt; text-decoration: underline;">Độc lập - Tự do - Hạnh phúc</p>
            <p style="margin: 0; font-size: 10pt; margin-top: 5px;"><i>Tây Đô, ngày 31 tháng 10 năm 2026</i></p>
          </td>
        </tr>
      </table>
      ${contentHtml}
    </body>
    </html>
  `;

  const blob = new Blob(['\ufeff', headerHtml], {
    type: 'application/msword;charset=utf-8'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileName}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Tạo nội dung HTML cho Ma trận kiểm tra
 */
export function generateMatrixHtml(matrix: ExamMatrix): string {
  let rowsHtml = '';
  matrix.rows.forEach((r, idx) => {
    rowsHtml += `
      <tr>
        <td class="text-center">${idx + 1}</td>
        <td><b>${r.topic}</b><br/><small>${r.unit}</small></td>
        <td class="text-center">${r.questionType === 'single_choice' ? 'Trắc nghiệm 1 ĐA' : r.questionType === 'true_false_group' ? 'Đúng - Sai' : r.questionType === 'short_answer' ? 'Trả lời ngắn' : 'Tự luận'}</td>
        <td class="text-center">${r.knowCount} (${r.knowPoints}đ)</td>
        <td class="text-center">${r.understandCount} (${r.understandPoints}đ)</td>
        <td class="text-center">${r.applyCount} (${r.applyPoints}đ)</td>
        <td class="text-center font-bold">${(r.knowPoints + r.understandPoints + r.applyPoints).toFixed(2)}đ</td>
      </tr>
    `;
  });

  const totalKnow = matrix.rows.reduce((acc, r) => acc + r.knowPoints, 0);
  const totalUnderstand = matrix.rows.reduce((acc, r) => acc + r.understandPoints, 0);
  const totalApply = matrix.rows.reduce((acc, r) => acc + r.applyPoints, 0);

  return `
    <h2>${matrix.title.toUpperCase()}</h2>
    <p class="text-center"><b>Môn học:</b> ${matrix.subject === 'math' ? 'Toán học' : matrix.subject === 'informatics' ? 'Tin học' : 'Khoa học tự nhiên'} - <b>Khối:</b> ${matrix.grade} | <b>Thời gian làm bài:</b> ${matrix.durationMinutes} phút</p>
    <table>
      <thead>
        <tr>
          <th rowspan="2" style="width: 5%;">STT</th>
          <th rowspan="2" style="width: 30%;">Chủ đề / Đơn vị kiến thức</th>
          <th rowspan="2" style="width: 15%;">Dạng câu</th>
          <th colspan="3">Mức độ nhận thức</th>
          <th rowspan="2" style="width: 12%;">Tổng điểm</th>
        </tr>
        <tr>
          <th>Nhận biết</th>
          <th>Thông hiểu</th>
          <th>Vận dụng</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
        <tr class="font-bold" style="background-color: #f9f9f9;">
          <td colspan="3" class="text-center">TỔNG CỘNG ĐIỂM SỐ</td>
          <td class="text-center">${totalKnow.toFixed(2)}đ (${matrix.cognitiveRatio.knowPercent}%)</td>
          <td class="text-center">${totalUnderstand.toFixed(2)}đ (${matrix.cognitiveRatio.understandPercent}%)</td>
          <td class="text-center">${totalApply.toFixed(2)}đ (${matrix.cognitiveRatio.applyPercent}%)</td>
          <td class="text-center">${matrix.totalPoints.toFixed(2)}đ (100%)</td>
        </tr>
      </tbody>
    </table>
    <p><i>* Ghi chú: Định dạng chuẩn Times New Roman theo quy định kiểm tra đánh giá định kỳ bậc THCS.</i></p>
  `;
}

/**
 * Tạo nội dung HTML cho Đề kiểm tra chính thức
 */
export function generateExamPaperHtml(exam: Exam): string {
  let questionsHtml = '';
  exam.questions.forEach((q, idx) => {
    let optionsText = '';
    if (q.type === 'single_choice' && q.options) {
      optionsText = `<div style="margin-left: 20px;">
        ${q.options.map(opt => `<p style="margin: 4px 0;"><b>${opt.label}.</b> ${opt.text}</p>`).join('')}
      </div>`;
    } else if (q.type === 'true_false_group' && q.subItems) {
      optionsText = `<div style="margin-left: 20px;">
        ${q.subItems.map(item => `<p style="margin: 4px 0;"><b>${item.label})</b> ${item.text} <i>[Đúng / Sai]</i></p>`).join('')}
      </div>`;
    } else if (q.type === 'short_answer') {
      optionsText = `<p style="margin-left: 20px; font-style: italic;">Trả lời: ..........................................................................................</p>`;
    } else if (q.type === 'essay') {
      optionsText = `<p style="margin-left: 20px; font-style: italic;">(Học sinh làm bài tự luận vào giấy làm bài)</p>`;
    }

    questionsHtml += `
      <div style="margin-bottom: 16px;">
        <p><b>Câu ${idx + 1} (${q.points} điểm):</b> [${q.code}] ${q.stem}</p>
        ${optionsText}
      </div>
    `;
  });

  return `
    <h2>${exam.title.toUpperCase()}</h2>
    <p class="text-center font-bold">MÃ ĐỀ: ${exam.code} - THỜI GIAN: ${exam.durationMinutes} PHÚT</p>
    <p class="text-center"><i>(Đề thi gồm ${exam.questions.length} câu, thang điểm 10.0)</i></p>
    <hr style="margin: 15px 0;" />
    <div>
      ${questionsHtml}
    </div>
    <p class="text-center" style="margin-top: 30px;"><b>---------- HẾT ----------</b></p>
    <p class="text-center"><i>Cán bộ coi thi không giải thích gì thêm. Học sinh không được sử dụng tài liệu.</i></p>
  `;
}

/**
 * Tạo nội dung HTML cho Hướng dẫn chấm & Đáp án
 */
export function generateSolutionHtml(exam: Exam): string {
  let solutionsHtml = '';
  exam.questions.forEach((q, idx) => {
    let ans = '';
    if (q.type === 'single_choice') {
      ans = `Đáp án: <b>${q.correctAnswer}</b>`;
    } else if (q.type === 'true_false_group') {
      ans = `Đáp án: <b>${q.subItems?.map(s => `${s.label}) ${s.isCorrect ? 'Đúng' : 'Sai'}`).join('; ')}</b>`;
    } else if (q.type === 'short_answer') {
      ans = `Đáp án chấp nhận: <b>${q.acceptedAnswers?.join(' | ')}</b>`;
    } else if (q.type === 'essay') {
      ans = `<b>Đáp án mẫu & Biểu điểm:</b><br/>${q.sampleAnswer || ''}<br/>
        <ul>${q.rubric?.map(r => `<li>${r.criterion}: <b>${r.maxPoints}đ</b></li>`).join('') || ''}</ul>`;
    }

    solutionsHtml += `
      <tr>
        <td class="text-center">${idx + 1}</td>
        <td><b>Câu ${idx + 1}</b> (${q.code})</td>
        <td>${ans}</td>
        <td>${q.explanation || 'Xem chi tiết sách giáo khoa'}</td>
        <td class="text-center font-bold">${q.points}đ</td>
      </tr>
    `;
  });

  return `
    <h2>HƯỚNG DẪN CHẤM VÀ ĐÁP ÁN ĐỀ KIỂM TRA</h2>
    <p class="text-center"><b>${exam.title} - Mã đề: ${exam.code}</b></p>
    <table>
      <thead>
        <tr>
          <th style="width: 5%;">Câu</th>
          <th style="width: 15%;">Mã câu</th>
          <th style="width: 30%;">Đáp án</th>
          <th style="width: 40%;">Hướng dẫn giải chi tiết</th>
          <th style="width: 10%;">Điểm</th>
        </tr>
      </thead>
      <tbody>
        ${solutionsHtml}
      </tbody>
    </table>
  `;
}
