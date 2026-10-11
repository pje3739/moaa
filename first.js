const $ = (id) => document.getElementById(id);

let slots = [];
let votes = {};
let activeAppointmentId = null;

const generateButton = $("generate");
const createScreen = $("create-screen");
const voteScreen = $("vote-screen");
const supabaseUrl = window.SUPABASE_URL;
const supabaseAnonKey = window.SUPABASE_ANON_KEY;
const supabaseClient =
    window.supabase &&
    supabaseUrl &&
    !supabaseUrl.includes("YOUR_PROJECT_ID") &&
    supabaseAnonKey
        ? window.supabase.createClient(supabaseUrl, supabaseAnonKey)
        : null;

function formatDate(date) {
    const d = new Date(date + "T12:00:00");
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];

    return `${d.getMonth() + 1}월 ${d.getDate()}일 (${weekdays[d.getDay()]})`;
}

function showSupabaseError(action, error) {
    console.error(`Supabase ${action} failed:`, error);
    alert(`${action}에 실패했어요: ${error.message || "Supabase 연결을 확인해 주세요."}`);
}

function renderVoteScreen(appointment, appointmentVotes) {
    activeAppointmentId = appointment.id;
    slots = appointment.slots;
    votes = Object.fromEntries(
        appointmentVotes.map((vote) => [vote.voter_name, vote.selected_indices])
    );

    $("vote-title").textContent = appointment.title;
    $("vote-place").textContent = appointment.place
        ? "장소: " + appointment.place
        : "장소 미정";
    renderSlots();
    renderRanking();
    createScreen.hidden = true;
    voteScreen.hidden = false;
}

async function loadAppointment(appointmentId) {
    const { data, error } = await supabaseClient
        .from("appointments")
        .select("id, title, place, slots")
        .eq("id", appointmentId)
        .single();

    if (error) {
        showSupabaseError("투표 불러오기", error);
        return;
    }

    const { data: appointmentVotes, error: votesError } = await supabaseClient
        .from("votes")
        .select("voter_name, selected_indices")
        .eq("appointment_id", appointmentId);

    if (votesError) {
        showSupabaseError("투표 결과 불러오기", votesError);
        return;
    }

    renderVoteScreen(data, appointmentVotes);
}

// 시간 후보 만들기
generateButton.addEventListener("click", async function () {
    if (!supabaseClient) {
        alert("Supabase 설정이 필요해요. supabase-config.js에 Project URL을 입력해 주세요.");
        return;
    }

    const title = $("title").value.trim();
    const hostName = $("host-name").value.trim();
    const startDate = $("start-date").value;
    const endDate = $("end-date").value;
    const startTime = $("start-time").value;
    const endTime = $("end-time").value;
    const interval = Number($("interval").value);

    if (!title || !hostName || !startDate || !endDate || !startTime || !endTime) {
        alert("약속 이름, 만든 사람, 날짜, 시간을 모두 입력해 주세요!");
        return;
    }

    if (endDate < startDate) {
        alert("마지막 날짜는 시작 날짜보다 빠를 수 없어요!");
        return;
    }

    if (endTime <= startTime) {
        alert("마지막 시간은 시작 시간보다 늦어야 해요!");
        return;
    }

    const newSlots = [];
    const currentDate = new Date(startDate + "T12:00:00");
    const lastDate = new Date(endDate + "T12:00:00");

    while (currentDate <= lastDate) {
        const dateText =
            `${currentDate.getFullYear()}-` +
            `${String(currentDate.getMonth() + 1).padStart(2, "0")}-` +
            `${String(currentDate.getDate()).padStart(2, "0")}`;

        let minutes =
            Number(startTime.slice(0, 2)) * 60 +
            Number(startTime.slice(3, 5));
        const lastMinutes =
            Number(endTime.slice(0, 2)) * 60 +
            Number(endTime.slice(3, 5));

        while (minutes < lastMinutes) {
            const hour = String(Math.floor(minutes / 60)).padStart(2, "0");
            const minute = String(minutes % 60).padStart(2, "0");
            newSlots.push({ date: dateText, time: `${hour}:${minute}` });
            minutes += interval;
        }

        currentDate.setDate(currentDate.getDate() + 1);
    }

    if (newSlots.length > 200) {
        alert("후보가 너무 많아요. 날짜 범위나 시간 간격을 조정해 주세요!");
        return;
    }

    const { data, error } = await supabaseClient
        .from("appointments")
        .insert({
            title,
            host_name: hostName,
            place: $("place").value.trim(),
            memo: "",
            slots: newSlots
        })
        .select("id, title, place, slots")
        .single();

    if (error) {
        showSupabaseError("투표 만들기", error);
        return;
    }

    const url = new URL(window.location.href);
    url.searchParams.set("poll", data.id);
    window.history.pushState({}, "", url);
    renderVoteScreen(data, []);
});

// 날짜별 시간 후보 표시하기
function renderSlots() {
    const result = $("slots");
    result.replaceChildren();

    const slotsByDate = new Map();
    slots.forEach((slot, index) => {
        if (!slotsByDate.has(slot.date)) {
            slotsByDate.set(slot.date, []);
        }
        slotsByDate.get(slot.date).push({ slot, index });
    });

    slotsByDate.forEach((dateSlots, date) => {
        const dateGroup = document.createElement("section");
        dateGroup.className = "date-group";

        const heading = document.createElement("div");
        heading.className = "date-group-heading";

        const dateTitle = document.createElement("h3");
        dateTitle.textContent = formatDate(date);

        const candidateCount = document.createElement("span");
        candidateCount.className = "candidate-count";
        candidateCount.textContent = `시간 후보 ${dateSlots.length}개`;

        const timeGrid = document.createElement("div");
        timeGrid.className = "time-grid";

        dateSlots.forEach(({ slot, index }) => {
            const option = document.createElement("label");
            option.className = "time-option";

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.dataset.index = index;
            checkbox.setAttribute(
                "aria-label",
                `${formatDate(slot.date)} ${slot.time} 참여 가능`
            );

            const timeLabel = document.createElement("span");
            timeLabel.textContent = slot.time;
            option.append(checkbox, timeLabel);
            timeGrid.appendChild(option);
        });

        heading.append(dateTitle, candidateCount);
        dateGroup.append(heading, timeGrid);
        result.appendChild(dateGroup);
    });
}

// 투표 제출하기
$("submit-vote").addEventListener("click", async function () {
    if (!supabaseClient || !activeAppointmentId) {
        alert("Supabase 연결 또는 투표 정보가 없어요. 페이지를 새로고침해 주세요.");
        return;
    }

    const name = $("voter-name").value.trim();
    if (!name) {
        alert("이름을 입력해 주세요!");
        return;
    }

    const selected = [
        ...document.querySelectorAll("#slots input[type='checkbox']:checked")
    ].map((checkbox) => Number(checkbox.dataset.index));

    if (selected.length === 0) {
        alert("가능한 시간을 하나 이상 선택해 주세요!");
        return;
    }

    const { error } = await supabaseClient
        .from("votes")
        .insert({
            appointment_id: activeAppointmentId,
            voter_name: name,
            selected_indices: selected
        });

    if (error) {
        if (error.code === "23505") {
            alert("이 이름으로 이미 투표했어요.");
            return;
        }
        showSupabaseError("투표 제출", error);
        return;
    }

    document.querySelectorAll("#slots input[type='checkbox']")
        .forEach((checkbox) => {
            checkbox.checked = false;
        });

    const refreshed = await refreshVotes();
    alert(refreshed
        ? `${name}님의 투표를 반영했어요!`
        : "투표는 저장됐지만 최신 결과를 불러오지 못했어요. 잠시 후 새로고침해 주세요.");
});

async function refreshVotes() {
    const { data, error } = await supabaseClient
        .from("votes")
        .select("voter_name, selected_indices")
        .eq("appointment_id", activeAppointmentId);

    if (error) {
        showSupabaseError("투표 결과 불러오기", error);
        return false;
    }

    votes = Object.fromEntries(
        data.map((vote) => [vote.voter_name, vote.selected_indices])
    );
    renderRanking();
    return true;
}

// 인기 순위 표시하기
function renderRanking() {
    const ranking = $("ranking");
    ranking.replaceChildren();

    const counts = slots.map((slot, index) => {
        const count = Object.values(votes).filter(
            (selected) => selected.includes(index)
        ).length;

        return { slot, index, count };
    });

    counts.sort((a, b) =>
        b.count - a.count ||
        (a.slot.date + a.slot.time).localeCompare(b.slot.date + b.slot.time)
    );

    counts.forEach((item) => {
        const li = document.createElement("li");
        li.textContent =
            `${formatDate(item.slot.date)} ${item.slot.time} — ` +
            `${item.count}명 가능`;
        ranking.appendChild(li);
    });
}

// 약속 설정 화면으로 돌아가기
$("back-button").addEventListener("click", function () {
    voteScreen.hidden = true;
    createScreen.hidden = false;
    activeAppointmentId = null;

    const url = new URL(window.location.href);
    url.searchParams.delete("poll");
    window.history.replaceState({}, "", url);
});

const sharedMeetingId = new URLSearchParams(window.location.search).get("poll");
if (sharedMeetingId && supabaseClient) {
    loadAppointment(sharedMeetingId);
} else if (sharedMeetingId) {
    alert("Supabase 설정이 필요해요. supabase-config.js에 Project URL을 입력해 주세요.");
}
