init() {
    this.loadData();
    this.renderPeopleFilter();
    this.renderCalendar();
    this.updateStats();
    this.setupEventListeners();

    // Check for reminders every minute
    setInterval(() => this.checkReminders(), 60000);
},

// --- Data Management ---

loadData() {
    const storedEvents = localStorage.getItem('trip_events');
    const storedPeople = localStorage.getItem('trip_people');

    if (storedEvents) this.data.events = JSON.parse(storedEvents);
    else {
        // Demo Data
        this.data.events = [
            { id: 1, title: '项目会议', date: '2026-09-22', time: '10:00', personId: 1, reminder: true, reminderOffset: 15, note: '讨论Q4计划' },
            { id: 2, title: '家庭聚餐', date: '2026-09-25', time: '18:30', personId: 2, reminder: true, reminderOffset: 60, note: '海底捞' },
            { id: 3, title: '健身', date: '2026-09-22', time: '19:00', personId: null, reminder: false, reminderOffset: 0, note: '' }
        ];
    }

    if (storedPeople) this.data.people = JSON.parse(storedPeople);
    else {
        this.data.people = [
            { id: 1, name: '张三', relation: '同事' },
            { id: 2, name: '李四', relation: '家人' }
        ];
    }
},

saveData() {
    localStorage.setItem('trip_events', JSON.stringify(this.data.events));
    localStorage.setItem('trip_people', JSON.stringify(this.data.people));
    this.updateStats();
},

// --- Smart Parsing Logic (The Core Improvement) ---

previewParse() {
    const text = document.getElementById('parseInput').value;
    if (!text.trim()) {
        this.showToast('请输入需要解析的文本');
        return;
    }

    this.data.parsedEventsTemp = this.parseTextToEvents(text);
    this.renderParsePreview();
    document.getElementById('parsePreview').classList.remove('hidden');
},

parseTextToEvents(text) {
    const events = [];
    const lines = text.split('\n');
    const today = new Date();

    // Simple regex patterns for Chinese date/time
    // Matches: 9月25日, 明天, 下周一, 今天
    const datePatterns = [
        { regex: /(\d{1,2})月(\d{1,2})日/, type: 'absolute' },
        { regex: /明天/, type: 'tomorrow' },
        { regex: /今天/, type: 'today' },
        { regex: /下周一/, type: 'next_monday' } // Simplified for demo
    ];

    // Matches: 下午3点, 10:00, 15:30, 晚上7点
    const timePatterns = [
        { regex: /(\d{1,2})[:：](\d{2})/, type: '24h' },
        { regex: /(上午|下午|晚上|中午)?(\d{1,2})点/, type: '12h' }
    ];

    lines.forEach(line => {
        if (!line.trim()) return;

        let eventDate = null;
        let eventTime = null;
        let title = line.trim();
        let personId = null;

        // 1. Extract Date
        let dateMatch = null;
        for (let p of datePatterns) {
            const match = line.match(p.regex);
            if (match) {
                dateMatch = { ...match, type: p.type };
                break;
            }
        }

        if (dateMatch) {
            const d = new Date(today);
            if (dateMatch.type === 'absolute') {
                d.setMonth(parseInt(dateMatch[1]) - 1);
                d.setDate(parseInt(dateMatch[2]));
            } else if (dateMatch.type === 'tomorrow') {
                d.setDate(d.getDate() + 1);
            } else if (dateMatch.type === 'next_monday') {
                const day = d.getDay();
                const diff = (1 + 7 - day) % 7 || 7; // Next Monday
                d.setDate(d.getDate() + diff);
            }
            // Format YYYY-MM-DD
            eventDate = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            // Remove date string from title for cleaner title
            title = title.replace(dateMatch[0], '');
        } else {
            // Default to today if no date found
            eventDate = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
        }

        // 2. Extract Time
        let timeMatch = null;
        for (let p of timePatterns) {
            const match = line.match(p.regex);
            if (match) {
                timeMatch = { ...match, type: p.type };
                break;
            }
        }

        if (timeMatch) {
            let hours = 0, minutes = 0;
            if (timeMatch.type === '24h') {
                hours = parseInt(timeMatch[1]);
                minutes = parseInt(timeMatch[2]);
            } else {
                const period = timeMatch[1]; // 上午, 下午...
                let h = parseInt(timeMatch[2]);
                if (period === '下午' || period === '晚上') h += 12;
                if (period === '中午' && h === 12) h = 12; 
                hours = h;
            }
            eventTime = `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}`;
            title = title.replace(timeMatch[0], '');
        } else {
            eventTime = "09:00"; // Default time
        }

        // 3. Extract Person (Simple keyword matching against known people)
        // In a real app, this would be more sophisticated NLP
        this.data.people.forEach(p => {
            if (line.includes(p.name)) {
                personId = p.id;
                title = title.replace(p.name, '');
            }
        });

        // Clean up title
        title = title.replace(/[和与跟]/g, '').trim();
        if (!title) title = "未命名行程";

        events.push({
            id: Date.now() + Math.random(),
            title: title,
            date: eventDate,
            time: eventTime,
            personId: personId,
            reminder: true,
            reminderOffset: 15,
            note: `从文本导入: ${line.substring(0, 20)}...`
        });
    });

    return events;
},

renderParsePreview() {
    const container = document.getElementById('previewList');
    container.innerHTML = '';
    if (this.data.parsedEventsTemp.length === 0) {
        container.innerHTML = '<div class="text-gray-500 text-sm">未识别到有效行程</div>';
        return;
    }

    this.data.parsedEventsTemp.forEach(evt => {
        const person = this.data.people.find(p => p.id == evt.personId);
        const div = document.createElement('div');
        div.className = 'text-sm p-2 bg-white border rounded flex justify-between items-center';
        div.innerHTML = `
            <div>
                <span class="font-bold text-indigo-600">${evt.date} ${evt.time}</span>
                <span class="mx-1 text-gray-400">|</span>
                <span>${evt.title}</span>
                ${person ? `<span class="ml-2 text-xs bg-teal-100 text-teal-700 px-1 rounded">${person.name}</span>` : ''}
            </div>
        `;
        container.appendChild(div);
    });
},

confirmParseAndSave() {
    if (this.data.parsedEventsTemp.length === 0) {
        this.showToast('没有可导入的行程');
        return;
    }

    // Assign real IDs and save
    this.data.parsedEventsTemp.forEach(evt => {
        evt.id = Date.now() + Math.floor(Math.random() * 1000);
        this.data.events.push(evt);
    });

    this.saveData();
    this.refreshUI();
    this.closeModal('parserModal');
    this.showToast(`成功导入 ${this.data.parsedEventsTemp.length} 条行程`);
    document.getElementById('parseInput').value = '';
    document.getElementById('parsePreview').classList.add('hidden');
},

// --- Rendering ---

renderPeopleFilter() {
    const container = document.getElementById('peopleFilterList');
    const select = document.getElementById('eventPerson');

    // Reset
    container.innerHTML = '';
    // Keep the first option in select
    while (select.options.length > 1) {
        select.remove(1);
    }

    // "All" Option
    const allBtn = document.createElement('div');
    allBtn.className = `p-2 rounded cursor-pointer flex items-center justify-between ${this.data.selectedPersonId === null ? 'bg-indigo-100 text-indigo-700 font-semibold' : 'hover:bg-gray-100 text-gray-600'}`;
    allBtn.innerHTML = `<span><i class="fa-solid fa-layer-group mr-2"></i>全部行程</span>`;
    allBtn.onclick = () => { this.data.selectedPersonId = null; this.refreshUI(); };
    container.appendChild(allBtn);

    this.data.people.forEach(person => {
        // Sidebar Filter Item
        const item = document.createElement('div');
        const isSelected = this.data.selectedPersonId === person.id;
        item.className = `p-2 rounded cursor-pointer flex items-center justify-between ${isSelected ? 'bg-indigo-100 text-indigo-700 font-semibold' : 'hover:bg-gray-100 text-gray-600'}`;
        item.innerHTML = `
            <span><i class="fa-solid fa-user mr-2"></i>${person.name}</span>
            <span class="text-xs bg-gray-200 px-2 py-0.5 rounded-full text-gray-500">${this.getEventCountForPerson(person.id)}</span>
        `;
        item.onclick = () => { this.data.selectedPersonId = person.id; this.refreshUI(); };
        container.appendChild(item);

        // Select Option in Modal
        const option = document.createElement('option');
        option.value = person.id;
        option.textContent = `${person.name} (${person.relation})`;
        select.appendChild(option);
    });
},

renderCalendar() {
    const year = this.data.currentDate.getFullYear();
    const month = this.data.currentDate.getMonth();

    document.getElementById('currentMonthDisplay').textContent = `${year}年 ${month + 1}月`;

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const calendarDays = document.getElementById('calendarDays');
    calendarDays.innerHTML = '';

    // Empty cells for previous month
    for (let i = 0; i < firstDay; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'bg-gray-50 min-h-[100px]';
        calendarDays.appendChild(emptyCell);
    }

    // Days
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const cell = document.createElement('div');
        cell.className = 'bg-white min-h-[100px] p-2 border-t border-l border-gray-100 calendar-day relative group';

        // Highlight today
        const today = new Date();
        if (today.getDate() === day && today.getMonth() === month && today.getFullYear() === year) {
            cell.classList.add('bg-indigo-50');
        }

        // Day Number
        const dayNum = document.createElement('span');
        dayNum.className = 'text-sm font-semibold text-gray-700 block mb-1';
        dayNum.textContent = day;
        cell.appendChild(dayNum);

        // Events for this day
        const dayEvents = this.getFilteredEvents().filter(e => e.date === dateStr);
        dayEvents.sort((a, b) => a.time.localeCompare(b.time));

        dayEvents.forEach(evt => {
            const person = this.data.people.find(p => p.id == evt.personId);
            const personColor = person ? this.getColorForId(person.id) : '#9ca3af'; // Gray if no person

            const evtEl = document.createElement('div');
            evtEl.className = 'text-xs p-1 mb-1 rounded bg-white border-l-4 shadow-sm cursor-pointer hover:shadow-md transition truncate';
            evtEl.style.borderLeftColor = personColor;
            evtEl.innerHTML = `
                <div class="font-bold text-gray-800 truncate">${evt.time} ${evt.title}</div>
                ${person ? `<div class="text-[10px] text-gray-500 truncate"><i class="fa-solid fa-user" style="color:${personColor}"></i> ${person.name}</div>` : ''}
            `;
            evtEl.onclick = (e) => {
                e.stopPropagation();
                this.openEditEventModal(evt.id);
            };
            cell.appendChild(evtEl);
        });

        // Add Button on Hover
        const addBtn = document.createElement('button');
        addBtn.className = 'absolute bottom-2 right-2 w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition hover:bg-indigo-600 hover:text-white';
        addBtn.innerHTML = '<i class="fa-solid fa-plus text-xs"></i>';
        addBtn.onclick = () => {
            document.getElementById('eventDate').value = dateStr;
            this.openAddEventModal();
        };
        cell.appendChild(addBtn);

        calendarDays.appendChild(cell);
    }
},

renderListView() {
    const container = document.getElementById('eventListContainer');
    container.innerHTML = '';

    const filtered = this.getFilteredEvents();

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="text-center py-10 text-gray-400">
                <i class="fa-regular fa-calendar-xmark text-4xl mb-2"></i>
                <p>暂无行程记录</p>
            </div>
        `;
        return;
    }

    // Group by Date
    const grouped = {};
    filtered.forEach(evt => {
        if (!grouped[evt.date]) grouped[evt.date] = [];
        grouped[evt.date].push(evt);
    });

    Object.keys(grouped).sort().forEach(date => {
        const dateHeader = document.createElement('div');
        dateHeader.className = 'sticky top-0 bg-gray-100 px-4 py-2 text-sm font-bold text-gray-600 rounded-lg mb-2 mt-4 z-10';
        dateHeader.textContent = date;
        container.appendChild(dateHeader);

        grouped[date].forEach(evt => {
            const person = this.data.people.find(p => p.id == evt.personId);
            const card = document.createElement('div');
            card.className = 'bg-white p-4 rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition flex justify-between items-center';

            const personBadge = person 
                ? `<span class="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600 ml-2"><i class="fa-solid fa-user mr-1" style="color:${this.getColorForId(person.id)}"></i>${person.name}</span>` 
                : '';

            card.innerHTML = `
                <div class="flex-1">
                    <div class="flex items-center mb-1">
                        <span class="font-bold text-indigo-600 mr-2">${evt.time}</span>
                        <h3 class="font-semibold text-gray-800">${evt.title}</h3>
                        ${personBadge}
                    </div>
                    <p class="text-sm text-gray-500 truncate">${evt.note || '无备注'}</p>
                </div>
                <div class="flex space-x-2 ml-4">
                    <button onclick="app.openEditEventModal(${evt.id})" class="text-gray-400 hover:text-indigo-600 p-2"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button onclick="app.deleteEvent(${evt.id})" class="text-gray-400 hover:text-red-500 p-2"><i class="fa-solid fa-trash"></i></button>
                </div>
            `;
            container.appendChild(card);
        });
    });
},

updateStats() {
    const ctx = document.getElementById('statsChart').getContext('2d');

    // Prepare Data: Count events per person
    const labels = this.data.people.map(p => p.name);
    const data = this.data.people.map(p => this.getEventCountForPerson(p.id));

    // Colors
    const colors = this.data.people.map((_, index) => this.getColorForId(index + 1));

    if (this.data.chartInstance) {
        this.data.chartInstance.destroy();
    }

    this.data.chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 10, usePointStyle: true } }
            },
            cutout: '70%'
        }
    });
},

refreshUI() {
    this.renderPeopleFilter();
    if (this.data.viewMode === 'calendar') {
        this.renderCalendar();
    } else {
        this.renderListView();
    }
},

// --- Helpers ---

getFilteredEvents() {
    let events = [...this.data.events];

    // Filter by Person
    if (this.data.selectedPersonId) {
        events = events.filter(e => e.personId == this.data.selectedPersonId);
    }

    // Filter by Search
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    if (searchTerm) {
        events = events.filter(e => 
            e.title.toLowerCase().includes(searchTerm) || 
            (e.note && e.note.toLowerCase().includes(searchTerm))
        );
}

    return events;
},

getEventCountFor<code_start project_name=智能行程提取与分类Web应用 filename=index.htmlPerson(personId) {
    return title=智能行程提取主界面 this.data.events.filter(e => e.person entrypoint=true runnable=false project_finalId == personId).length;_file=false>
<!DOCTYPE html>
},

getColorForI
<html lang="zh-CN"> d(id) { const colors =<head> <meta charset="UTF ['#4f46e5',-8"> <meta nam '#0d9488',e="viewport" content="width=device-width '#db2777', '#ea580c', '#65a30d', ', initial-scale=1.0"> <title>智能行程伴侣 - AI提取版#7c3aed']; return colors</title> <!-- Tailwin[(id - 1) % colorsd CSS --> <script src="https://.length]; },
changcdn.tailwindcss.com"></script>eMonth(delta) {
    this.dat
<!-- Font Awesome -->
a.currentDate.setMonth(this.data.currentDat <link rel="stylesheet" href="e.getMonth() + delta);
thishttps://cdnjs.cloudflare.com/ajax/libs/font.renderCalendar();
},

toggleView(mode) {
    this-awesome/6.4.0/css/all.min.css">.data.viewMode = mode;

<!-- Chart.js -->
document.getElementById('calendarView').classList.toggl <script src="https://cdn.jsdelivre('hidden', mode !== 'calendar');.net/npm/chart.js"></script>

    document.getElementById('listView').    <style>
    body {classList.toggle('hidden', mode !== ' font-family: 'Segoe UI', Roblist');
    this.refreshUI();oto, Helvetica, Arial, sans-serif
},

setupEventListeners; background-color: #f3f() {
    document.getElementById('search4f6; }
    .Input').addEventListener('input', () =>glass-effect { background: rgba( this.refreshUI());
},
255, 255, // --- Modals & Forms --- 255, 0.
openParserModal() {
9); backdrop-filter: blur( document.getElementById('parserModal').classList10px); border: 1px.remove('hidden');
document.getElementByI solid rgba(255, d('parsePreview').classList.255, add('hidden');
},

255, 0.2); }
openAddEventModal() {
.calendar-day { transition: document.getElementById('eventForm').reset(); all 0.2s; min
document.getElementById('eventId').valu-height: 100px;e = '';
document.getElementById('modal }
.calendar-day:hover { transform: scale(Title').textContent = '新建行程';
// Default date to today1.02); z-index: 10; box-shadow: if not set
if (!document.getElementById('eventDate').value) {0 4px 6px -
document.getElementById('eventDate').1px rgba(0, 0,valueAsDate = new Date();
0, 0.1); }
document.getElementById('event }
.event-dot { widthModal').classList.remove('hidden');
: 6px; height: 6px; border },

-radius: openEditEventModal(id) {
const evt =50%; display: inline-block; margin-right: 2px; }
this.data.events.find(e => e. ::-webkit-scrollbar {id === id);
if (!evt width: 8px; }
) return;

    document.getElementById('        ::-webkit-scrollbar-track {eventId').value = evt.id;
background: #f1f1f document.getElementById('eventTitle').valu1; }
::-webkite = evt.title;
document.getElementByI-scrollbar-thumb { background: #cbd('eventDate').value = evt.datd5e1; border-radius: e;
document.getElementById('eventTime').value = evt.time;
4px; }
::-webkit-scrollbar-thumb:hover { background: document.getElementById('eventPerson').value = #94a3b8; evt.personId || '';
document }
.fade-in { animation.getElementById('eventReminder').checked = evt: fadeIn 0.3s eas.reminder;
document.getElementById('e-in-out; }
@keyreminderTime').value = evt.reminderframes fadeIn { from { opacity: Offset;
document.getElementById('event0; transform: translateY(Note').value = evt.note || '';10px); } to { opacity:
    document.getElementById('modalTitl1; transform: translateY(0);e').textContent = '编辑行程';
} }
.highlight-text { document.getElementById('eventModal').classList background-color: #fef3c7; padding: .remove('hidden');
},

0 2px; border-radius: openAddPersonModal() {
2px; }
</ document.getElementById('personForm').reset();
documentstyle>
</.getElementById('personModalhead>

<body class').classList.remove('hidden'); ="h-screen flex flex-col overflow-hidden },
closeModal(modalI text-slate-800">d) {
    document.getElementById(modal

<!-- Header -->
<header class="bgId).classList.add('hidden');
-gradient-to-r from-indigo- },

saveEvent(e)600 to-purple-600 text {
    e.preventDefault();
    const id = document.getElementById('eventId').-white shadow-lg z-20">value;
    const newEvent =
    <div class="container mx-auto px- {
        id: id ? parseInt4 py-4 flex justify-between items-center(id) : Date.now(),
">
<div class="flex items-center space-x title: document.getElementById('eventTitl-3">
<i classe').value,
date: document="fa-solid fa-wand-magic.getElementById('eventDate').value,
-sparkles text- time: document.getElementById('eventTim2xl"></i>
e').value,
personId: <h1 class="text-xl font-bold tracking-w document.getElementById('eventPerson').value ?ide">智能行程伴侣</h1> parseInt(document.getElementById('eventPerson').value) : null,
reminder:
</div>
<div class="flex document.getElementById('eventReminder').checked, items-center space-x-4">

        reminderOffset: parseInt(document.getElementByI                <button onclick="app.toggleViewd('reminderTime').value),
       ('list')" class="hover:bg note: document.getElementById('eventNote').-white/20 p-2 rounvalue
    };

    if (ded-full transition" title="列表视图"><i class="fid) {
        const index =a-solid fa-list"></i></button> this.data.events.findIndex(ev => ev.id == id);
        this.data.events
            <button onclick="app.toggleView('calendar')"[index] = newEvent;
    class="hover:bg-white/ } else {
        this.data.events20 p-2 rounded-full transition" titl.push(newEvent);
    }
e="日历视图"><i class="fa-solid fa-calendar-days this.saveData(); this.refreshUI(); this.closeModal"></i></button>
<button onclick="app.openSettings()" class="hover('eventModal');
this.showToast/20 p-('行程已保存');
},

deleteEvent(id) {
2 rounded-full transition" title="设置"><i class="f if (confirm('确定要删除a-solid fa-gear"></i></button这个行程吗？')) {
>
</div>
this.data.events = this.data.events.filter </div>
</header>

(e => e.id !== id);
this.saveData();
this <!-- Main Content -->
<main class="flex-1 flex overflow-hidden relative">
.refreshUI();
this.showToast('行程已删除');
}
    <!-- Sidebar: People Filter &    },

savePerson(e) Stats -->
    <aside class="w {
    e.preventDefault();
   -64 bg-white shadow-md z const name = document.getElementById('personNam-10 hidden md:flex flex-cole').value;
    const relation =">
        <div class="p-4 border-b document.getElementById('personRelation').value; border-gray-100">
    const newPerson = {
        id: Date.now(),
            <h2 class="font-semibold text-gray-            name,
        relation
   700 mb-3"><i class };

    this.data.people.push(newPerson);
    this.saveData();="fa-solid fa-users mr-2"></i>按人员筛选</h
    this.refreshUI();
   2>
            <div id=" this.closeModal('personModal');
peopleFilterList" class="space-y this.showToast('联系人已添加');-2 max-h-60 overflow
},
// --- Rem-y-auto">
                <!-- Dynamic Peoplinders ---

checkReminders()e Filters -->
            </div>
{
const now = new Dat <button onclick="app.opene(); const currentStr = `${AddPersonModal()" class="mt-now.getFullYear()}-${String(now.getMonth()+3 w-full py-2 px-1).padStart(2,'4 border border-dashed border-indigo-0')}-${String(now.getDate()).padStart300 text-indigo-(2,'0')}`; 600 rounded hover:bg-indigo- const currentTime = `${String(now.getHours50 transition text-sm">
()).padStart(2,'0') <i class="fa-solid fa-plus}:${String(now.getMinutes()).padStart( mr-1"></i> 添加2,'0')}`;

联系人
</button>
// Convert current time to minutes for </div>

        <div class="p- comparison
    const currentMinutes = now4 flex-1 overflow-y-auto">.getHours() * 60 + now.getMinutes();

    this.data.events
            <h2 class="font-semibold text-gray-.forEach(evt => {
        if (700 mb-3"><i class="fa-solevt.reminder && evt.date === currentid fa-chart-pie mr-2"></Str) {
            // Parse eventi>行程统计</h2> time
            const [h, m] = evt.time.split(':').map
            <canvas id="statsChart"></canvas>
(Number);
const eventMinutes = </div>
</as h * 60 + m;ide>
    <!-- Center: Calendar /

            // Calculate trigger time
List View -->
<section class const triggerMinutes = eventMinutes -="flex-1 flex flex-col bg evt.reminderOffset;

           -gray-50 relative overflow-hidden"> // Check if we are within the minut

        <!-- Toolbar -->
       e window (simple check)
            // <div class="bg-white p- In a real app, we'd stor4 shadow-sm flex justify-between items-centere "last notified" to avoid spamming z-10">
            <div class="flex
            if (currentMinutes === trigger items-center space-x-4">
Minutes) {
this.showToast( <button onclick="app.changeMonth提醒: ${evt.title} 即将(-1)" class="text-gray-开始!, true);
//500 hover:text-indigo- Play sound could go here
}
}
});
600"><i class="fa-solid fa-chevron-left },
showToast(msg, is"></i></button>
                <h2 id="Alert = false) {
    constcurrentMonthDisplay" class="text-lg toast = document.getElementById('toast');
font-bold text-gray- const msgEl = document.getElementById('800">2026年 toastMessage');
msgEl.textContent = msg;

    if (9月</h2>
                <button onclick="appisAlert) {
        toast.classList.changeMonth(1)" class="text.replace('bg-gray--gray-500 hover:text-in800', 'bg-red-digo-600"><i class600');
    } else {
       ="fa-solid fa-chevron-right"></ toast.classList.replace('bg-red-i></button>
            </div>600', 'bg-gray-800');
    }


            <div class="flex space-x-2"> toast.classList.remove('translate-y-
                <input type="text" id="searchInput20', 'opacity-0');
" placeholder="搜索行程..." class=" setTimeout(() => {
toastborder border-gray-300 roun.classList.add('translate-y-ded-lg px-3 py-1 text20', 'opacity-0');
-sm focus focus:ring }, 3000);
-2 focus:ring-indigo- },
openSettings() {
    alert("设置500">
                <button onclick="app.open功能：\n1. 数据AddEventModal()" class="bg-indigo导出/导入 (JSON)\n-600 hover:bg-indigo2. 默认提醒时间设置\n-700 text-white px-3. 主题切换 (暂未实现)4 py-2 rounded-lg shadow transition");
}
};

// flex items-center">
<i class="fa-sol Start App document.addEventListener('DOMContentLoaded',id fa-plus mr-2"></i> () => {
app.init(); 新建行程
</button>
});
</code_end>
