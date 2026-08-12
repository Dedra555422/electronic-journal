(function() {
  const SUPABASE_URL = 'https://ucbnqqlpflwaainfpxxv.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_mU-PHJl92-VjcMz3ZiPOvg_RSz3JETp';
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const SUBJECTS = {
    'обычное': ['Военное право', 'Военная подготовка', 'Военно-тактическая подготовка'],
    'платное': ['Военное право', 'Военная подготовка', 'Военно-тактическая подготовка', 'Совместная тренировка с военной прокуратурой']
  };

  const pages = {
    schedule: document.getElementById('page-schedule'),
    login: document.getElementById('page-login'),
    register: document.getElementById('page-register'),
    teacher: document.getElementById('page-teacher'),
    student: document.getElementById('page-student'),
    paid: document.getElementById('page-paid'),
    admin: document.getElementById('page-admin'),
    deptRegular: document.getElementById('page-dept-regular'),
    deptPaid: document.getElementById('page-dept-paid'),
    pending: document.getElementById('page-pending')
  };
  
  let currentUser = null;
  let userRole = null;
  let currentUsername = '';
  let currentFullName = '';
  let currentDepartment = 'обычное';

  function showPage(pageId) {
    Object.values(pages).forEach(p => p.classList.remove('active'));
    if (pages[pageId]) pages[pageId].classList.add('active');
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
    const navBtn = document.querySelector(`nav button[data-page="${pageId}"]`);
    if (navBtn) navBtn.classList.add('active');
  }

  document.getElementById('mainNav').addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON' && e.target.dataset.page) showPage(e.target.dataset.page);
  });

  function updateUIForUser(user) {
    const userBar = document.getElementById('userBar');
    const mainNav = document.getElementById('mainNav');
    if (user) {
      userBar.style.display = 'flex';
      document.getElementById('userDisplayName').textContent = currentUsername || 'Пользователь';
      const badge = document.getElementById('roleBadge');
      badge.classList.remove('pending');
      if (userRole === 'teacher') {
        badge.textContent = 'Преподаватель';
        mainNav.innerHTML = `
          <button data-page="dept-regular">📘 Обычное отделение</button>
          <button data-page="dept-paid">💎 Платное отделение</button>
          <button data-page="teacher">📝 Весь журнал</button>
          <button data-page="schedule">📅 Расписание</button>
          <button data-page="paid">💎 Платное</button>
        `;
        showPage('dept-regular');
        loadDepartmentPage('обычное');
      } else if (userRole === 'student') {
        badge.textContent = 'Курсант';
        mainNav.innerHTML = `
          <button data-page="student">📖 Оценки</button>
          <button data-page="schedule">📅 Расписание</button>
          <button data-page="paid">💎 Платное</button>
        `;
        showPage('student');
        loadStudentGrades();
      } else if (userRole === 'admin') {
        badge.textContent = 'Администратор';
        mainNav.innerHTML = `
          <button data-page="dept-regular">📘 Обычное отделение</button>
          <button data-page="dept-paid">💎 Платное отделение</button>
          <button data-page="admin">⚙️ Админ</button>
          <button data-page="schedule">📅 Расписание</button>
          <button data-page="paid">💎 Платное</button>
        `;
        showPage('admin');
        loadAdminData();
        loadDepartmentPage('обычное');
        loadDepartmentPage('платное');
      } else if (userRole === 'pending') {
        badge.textContent = 'Ожидание';
        badge.classList.add('pending');
        mainNav.innerHTML = '<button data-page="schedule">📅 Расписание</button>';
        showPage('pending');
      }
    } else {
      userBar.style.display = 'none';
      mainNav.innerHTML = '<button data-page="schedule">📅 Расписание</button><button data-page="login">🔐 Вход</button><button data-page="register">📝 Регистрация</button>';
      showPage('schedule');
    }
  }

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await supabase.auth.signOut();
  });

  supabase.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
      currentUser = session.user;
      const { data: userData, error } = await supabase
        .from('users')
        .select('username, full_name, department, role')
        .eq('id', currentUser.id)
        .single();
      if (error || !userData) {
        userRole = 'pending';
        currentUsername = 'Ожидание';
        currentFullName = '';
        currentDepartment = 'обычное';
      } else {
        userRole = userData.role;
        currentUsername = userData.username;
        currentFullName = userData.full_name || '';
        currentDepartment = userData.department || 'обычное';
      }
      updateUIForUser(currentUser);
      if (userRole === 'teacher') loadTeacherGrades();
      if (userRole === 'student') loadStudentGrades();
      if (userRole === 'admin') loadAdminData();
      loadSchedulePublic();
      loadPaidContent();
      if (userRole === 'teacher' || userRole === 'admin') {
        loadDepartmentPage('обычное');
        loadDepartmentPage('платное');
      }
    } else {
      currentUser = null; userRole = null; currentUsername = '';
      updateUIForUser(null);
      loadSchedulePublic();
    }
  });

  document.getElementById('registerSubmit').addEventListener('click', async () => {
    const msg = document.getElementById('registerMessage');
    msg.innerHTML = '';
    const username = document.getElementById('regUsername').value.trim();
    const password = document.getElementById('regPassword').value;
    const fullName = document.getElementById('regFullName').value.trim();

    if (!username || password.length < 6) {
      msg.innerHTML = '<div class="message error">Введите ник и пароль (мин 6 символов)</div>';
      return;
    }

    const fakeEmail = `${username}@journal.local`;
    const { data, error } = await supabase.auth.signUp({ email: fakeEmail, password });
    if (error) {
      msg.innerHTML = `<div class="message error">${error.message}</div>`;
      return;
    }

    if (data.user) {
      const { error: insertError } = await supabase.from('users').insert([
        {
          id: data.user.id,
          username: username,
          email: fakeEmail,
          full_name: fullName,
          department: 'обычное',
          role: 'admin'
        }
      ]);
      if (insertError) {
        msg.innerHTML = '<div class="message error">Ошибка сохранения пользователя. Возможно, ник уже занят.</div>';
        return;
      }
    }

    msg.innerHTML = '<div class="message success">Вы зарегистрированы как администратор! Войдите, чтобы продолжить.</div>';
    setTimeout(() => showPage('login'), 1500);
  });

  document.getElementById('loginSubmit').addEventListener('click', async () => {
    const msg = document.getElementById('loginMessage');
    msg.innerHTML = '';
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    if (!username || !password) {
      msg.innerHTML = '<div class="message error">Введите ник и пароль</div>';
      return;
    }
    const { data: userRow, error: findError } = await supabase
      .from('users')
      .select('email')
      .eq('username', username)
      .single();
    if (findError || !userRow) {
      msg.innerHTML = '<div class="message error">Пользователь с таким ником не найден.</div>';
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: userRow.email,
      password: password
    });
    if (error) msg.innerHTML = `<div class="message error">${error.message}</div>`;
  });

  async function loadSchedulePublic() {
    const container = document.getElementById('scheduleContent');
    const { data, error } = await supabase.from('schedule').select('*').order('day');
    if (error || !data?.length) { container.innerHTML = '<p>Расписание пока пусто.</p>'; return; }
    let html = '<table class="schedule-table"><tr><th>День</th><th>Время</th><th>Предмет</th><th>Преподаватель</th></tr>';
    data.forEach(d => html += `<tr><td>${d.day||''}</td><td>${d.time||''}</td><td>${d.subject||''}</td><td>${d.teacher||''}</td></tr>`);
    html += '</table>';
    container.innerHTML = html;
  }

  async function loadDepartmentPage(department) {
    const scheduleContainer = department === 'обычное' 
      ? document.getElementById('deptRegularSchedule') 
      : document.getElementById('deptPaidSchedule');
    const tableContainer = department === 'обычное' 
      ? document.getElementById('deptRegularTable') 
      : document.getElementById('deptPaidTable');

    const subjects = SUBJECTS[department] || [];
    const { data: scheduleData, error: scheduleError } = await supabase
      .from('schedule')
      .select('*')
      .order('day');
    if (scheduleError) {
      scheduleContainer.innerHTML = '<p>Ошибка загрузки расписания.</p>';
    } else if (!scheduleData || scheduleData.length === 0) {
      scheduleContainer.innerHTML = '<p>Расписание пока пусто.</p>';
    } else {
      const filtered = scheduleData.filter(item => subjects.includes(item.subject));
      if (filtered.length === 0) {
        scheduleContainer.innerHTML = '<p>Нет занятий по предметам этого отделения.</p>';
      } else {
        let html = '<table class="schedule-table"><tr><th>День</th><th>Время</th><th>Предмет</th><th>Преподаватель</th></tr>';
        filtered.forEach(d => html += `<tr><td>${d.day||''}</td><td>${d.time||''}</td><td>${d.subject||''}</td><td>${d.teacher||''}</td></tr>`);
        html += '</table>';
        scheduleContainer.innerHTML = html;
      }
    }

    const { data: students, error: studentError } = await supabase
      .from('users')
      .select('id, username, full_name')
      .eq('role', 'student')
      .eq('department', department);
    if (studentError) {
      tableContainer.innerHTML = '<p>Ошибка загрузки студентов.</p>';
      return;
    }
    if (!students || students.length === 0) {
      tableContainer.innerHTML = '<p>Нет курсантов в этом отделении.</p>';
      return;
    }

    const { data: grades } = await supabase.from('grades').select('student_id, subject, grade');
    const gradesMap = {};
    if (grades) {
      grades.forEach(g => {
        if (!gradesMap[g.student_id]) gradesMap[g.student_id] = {};
        gradesMap[g.student_id][g.subject] = g.grade;
      });
    }

    const allSubjects = SUBJECTS[department] || [];
    let html = '<table><tr><th>ФИО</th>';
    allSubjects.forEach(subj => html += `<th>${subj}</th>`);
    html += '<th></th></tr>';

    students.forEach(student => {
      html += `<tr>`;
      html += `<td>${student.full_name || student.username}</td>`;
      allSubjects.forEach(subj => {
        const currentGrade = gradesMap[student.id]?.[subj] || '';
        html += `<td><input class="grade-input" type="number" min="2" max="5" id="dept_grade_${student.id}_${subj.replace(/ /g,'_')}" value="${currentGrade}"></td>`;
      });
      html += `<td><button class="btn-primary" style="width:auto; padding:0.4rem 1rem;" onclick="window.saveDeptStudentGrades('${student.id}', '${department}')">💾 Сохранить</button></td>`;
      html += `</tr>`;
    });
    html += '</table>';
    tableContainer.innerHTML = html;
  }

  window.saveDeptStudentGrades = async (studentId, department) => {
    const subjects = SUBJECTS[department] || [];
    const rows = [];
    for (const subj of subjects) {
      const inputId = `dept_grade_${studentId}_${subj.replace(/ /g,'_')}`;
      const input = document.getElementById(inputId);
      if (input) {
        const val = input.value.trim();
        if (val) {
          const num = parseInt(val, 10);
          if (num >= 2 && num <= 5) {
            rows.push({ student_id: studentId, subject: subj, grade: num, updated_at: new Date() });
          } else {
            alert(`Оценка по предмету "${subj}" должна быть от 2 до 5`);
            return;
          }
        }
      }
    }
    if (rows.length === 0) { alert('Нет оценок для сохранения'); return; }
    const { error } = await supabase
      .from('grades')
      .upsert(rows, { onConflict: 'student_id,subject' });
    if (error) { alert('Ошибка сохранения: ' + error.message); return; }
    alert('Оценки сохранены!');
  };

  async function loadTeacherGrades() {
    const container = document.getElementById('teacherGrades');
    const { data: students, error: studentError } = await supabase
      .from('users')
      .select('id, username, full_name, department')
      .eq('role', 'student');
    if (studentError) { container.innerHTML = '<p>Ошибка загрузки студентов.</p>'; return; }
    if (!students || students.length === 0) { container.innerHTML = '<p>Нет зарегистрированных курсантов.</p>'; return; }

    const { data: grades } = await supabase.from('grades').select('student_id, subject, grade');
    const gradesMap = {};
    if (grades) {
      grades.forEach(g => {
        if (!gradesMap[g.student_id]) gradesMap[g.student_id] = {};
        gradesMap[g.student_id][g.subject] = g.grade;
      });
    }

    let html = '<table><tr><th>ФИО</th><th>Отделение</th>';
    const allSubjects = Object.values(SUBJECTS).flat();
    allSubjects.forEach(subj => html += `<th>${subj}</th>`);
    html += '<th></th></tr>';

    students.forEach(student => {
      const dept = student.department || 'обычное';
      const subjectsForDept = SUBJECTS[dept] || SUBJECTS['обычное'];
      html += `<tr>`;
      html += `<td>${student.full_name || student.username}</td>`;
      html += `<td>${dept}</td>`;
      allSubjects.forEach(subj => {
        if (subjectsForDept.includes(subj)) {
          const currentGrade = gradesMap[student.id]?.[subj] || '';
          html += `<td><input class="grade-input" type="number" min="2" max="5" id="grade_${student.id}_${subj.replace(/ /g,'_')}" value="${currentGrade}"></td>`;
        } else {
          html += `<td></td>`;
        }
      });
      html += `<td><button class="btn-primary" style="width:auto; padding:0.4rem 1rem;" onclick="window.saveStudentGrades('${student.id}')">💾 Сохранить</button></td>`;
      html += `</tr>`;
    });
    html += '</table>';
    container.innerHTML = html;
  }

  window.saveStudentGrades = async (studentId) => {
    const { data: studentData, error: stError } = await supabase
      .from('users')
      .select('department')
      .eq('id', studentId)
      .single();
    if (stError || !studentData) { alert('Ошибка получения данных студента'); return; }
    const dept = studentData.department || 'обычное';
    const subjects = SUBJECTS[dept] || SUBJECTS['обычное'];
    const rows = [];
    for (const subj of subjects) {
      const inputId = `grade_${studentId}_${subj.replace(/ /g,'_')}`;
      const input = document.getElementById(inputId);
      if (input) {
        const val = input.value.trim();
        if (val) {
          const num = parseInt(val, 10);
          if (num >= 2 && num <= 5) {
            rows.push({ student_id: studentId, subject: subj, grade: num, updated_at: new Date() });
          } else {
            alert(`Оценка по предмету "${subj}" должна быть от 2 до 5`);
            return;
          }
        }
      }
    }
    if (rows.length === 0) { alert('Нет оценок для сохранения'); return; }
    const { error } = await supabase
      .from('grades')
      .upsert(rows, { onConflict: 'student_id,subject' });
    if (error) { alert('Ошибка сохранения: ' + error.message); return; }
    alert('Оценки сохранены!');
  };

  async function loadStudentGrades() {
    const container = document.getElementById('studentGrades');
    if (!currentUser) return;
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('department')
      .eq('id', currentUser.id)
      .single();
    if (userError || !userData) { container.innerHTML = '<p>Ошибка загрузки отделения.</p>'; return; }
    const dept = userData.department || 'обычное';
    const subjects = SUBJECTS[dept] || SUBJECTS['обычное'];
    const { data: grades, error } = await supabase
      .from('grades')
      .select('subject, grade')
      .eq('student_id', currentUser.id);
    if (error) { container.innerHTML = '<p>Ошибка загрузки оценок.</p>'; return; }
    const gradesMap = {};
    if (grades) grades.forEach(g => gradesMap[g.subject] = g.grade);
    let html = '<table><tr><th>Предмет</th><th>Оценка</th></tr>';
    subjects.forEach(subj => {
      html += `<tr><td>${subj}</td><td>${gradesMap[subj] ?? '—'}</td></tr>`;
    });
    html += '</table>';
    container.innerHTML = html;
  }

  async function loadPaidContent() {
    const container = document.getElementById('paidContent');
    if (!currentUser) { container.innerHTML = '<p>🔒 Войдите, чтобы увидеть информацию.</p>'; return; }
    const { data } = await supabase.from('paid_sessions').select('*').eq('student_username', currentUsername);
    if (!data?.length) { container.innerHTML = '<p>У вас нет записей платного отделения.</p>'; return; }
    let html = '';
    data.forEach(d => html += `<div class="paid-card"><strong>🧑‍🏫 Проводит:</strong> ${d.trainer||'—'}<br><strong>🕒 Время:</strong> ${d.time||'—'}</div>`);
    container.innerHTML = html;
  }

  async function loadAdminData() {
    const { data: users } = await supabase.from('users').select('*');
    let userHtml = '<table><tr><th>Ник</th><th>ФИО</th><th>Роль</th><th>Отделение</th><th>Изменить</th></tr>';
    if (users) users.forEach(u => {
      userHtml += `<tr>
        <td>${u.username}</td>
        <td><input type="text" id="fio_${u.id}" value="${u.full_name||''}" placeholder="ФИО" style="width:200px;"></td>
        <td>
          <select id="role_${u.id}">
            <option value="student" ${u.role==='student'?'selected':''}>Курсант</option>
            <option value="teacher" ${u.role==='teacher'?'selected':''}>Преподаватель</option>
            <option value="admin" ${u.role==='admin'?'selected':''}>Администратор</option>
          </select>
        </td>
        <td>
          <select id="dept_${u.id}">
            <option value="обычное" ${u.department==='обычное'?'selected':''}>Обычное</option>
            <option value="платное" ${u.department==='платное'?'selected':''}>Платное</option>
          </select>
        </td>
        <td><button class="btn-primary" onclick="window.updateUserData('${u.id}')" style="width:auto; padding:0.4rem 1rem;">💾 Сохранить</button></td>
      </tr>`;
    });
    userHtml += '</table>';
    document.getElementById('adminUsers').innerHTML = userHtml;

    const { data: sched } = await supabase.from('schedule').select('*');
    let schedHtml = '';
    if (sched) sched.forEach(s => schedHtml += `<div><span>${s.day} ${s.time} — ${s.subject} (${s.teacher})</span> <button onclick="window.deleteItem('schedule',${s.id})" style="border:none; background:transparent; cursor:pointer;">❌</button></div>`);
    document.getElementById('adminScheduleList').innerHTML = schedHtml || '—';

    const { data: paid } = await supabase.from('paid_sessions').select('*');
    let paidHtml = '';
    if (paid) paid.forEach(p => paidHtml += `<div><span>${p.student_username} | ${p.trainer} | ${p.time}</span> <button onclick="window.deleteItem('paid_sessions',${p.id})" style="border:none; background:transparent; cursor:pointer;">❌</button></div>`);
    document.getElementById('adminPaidList').innerHTML = paidHtml || '—';
  }

  window.updateUserData = async (uid) => {
    const fullName = document.getElementById('fio_'+uid).value.trim();
    const role = document.getElementById('role_'+uid).value;
    const department = document.getElementById('dept_'+uid).value;
    const { error } = await supabase.from('users').update({ full_name: fullName, role, department }).eq('id', uid);
    if (error) alert('Ошибка обновления данных: ' + error.message);
    else {
      alert('Данные обновлены!');
      loadAdminData();
    }
  };

  window.deleteItem = async (table, id) => {
    await supabase.from(table).delete().eq('id', id);
    loadAdminData();
  };

  document.getElementById('addScheduleBtn').addEventListener('click', async () => {
    const day = document.getElementById('schedDay').value.trim();
    const time = document.getElementById('schedTime').value.trim();
    const subject = document.getElementById('schedSubject').value.trim();
    const teacher = document.getElementById('schedTeacher').value.trim();
    if (!day || !time || !subject) return alert('Заполните поля');
    await supabase.from('schedule').insert([{ day, time, subject, teacher }]);
    ['schedDay','schedTime','schedSubject','schedTeacher'].forEach(id => document.getElementById(id).value='');
    loadAdminData(); loadSchedulePublic();
    loadDepartmentPage('обычное');
    loadDepartmentPage('платное');
  });

  document.getElementById('addPaidBtn').addEventListener('click', async () => {
    const studentUsername = document.getElementById('paidStudent').value.trim();
    const trainer = document.getElementById('paidTrainer').value.trim();
    const time = document.getElementById('paidTime').value.trim();
    if (!studentUsername || !trainer || !time) return alert('Заполните все поля');
    await supabase.from('paid_sessions').insert([{ student_username: studentUsername, trainer, time }]);
    ['paidStudent','paidTrainer','paidTime'].forEach(id => document.getElementById(id).value='');
    loadAdminData();
  });

  showPage('schedule');
  loadSchedulePublic();
})();