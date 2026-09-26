const API_BASE = "https://equran.id/api/v2";

const state = {
  surahs: [],
  selectedSurah: null,
  selectedSurahNumber: null,
  mode: "guess",
  score: 0,
  question: null,
  answered: false,
  loadingSurahNumber: null,
};

const elements = {
  surahList: document.querySelector("#surah-list"),
  surahCount: document.querySelector("#surah-count"),
  surahListStatus: document.querySelector("#surah-list-status"),
  surahSearch: document.querySelector("#surah-search"),
  readingPanel: document.querySelector("#reading-panel"),
  quizArea: document.querySelector("#quiz-area"),
  scoreValue: document.querySelector("#score-value"),
  selectedSurahLabel: document.querySelector("#selected-surah-label"),
  nextQuestion: document.querySelector("#next-question"),
  restartQuiz: document.querySelector("#restart-quiz"),
};

async function fetchApi(path) {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) {
    throw new Error(`Server mengirim status ${response.status}.`);
  }

  const payload = await response.json();
  if (payload.code !== 200 || payload.data == null) {
    throw new Error(payload.message || "Respons API tidak berisi data yang dapat digunakan.");
  }
  return payload.data;
}

function createTextElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

function setReadingMessage(message, isError = false, retryNumber = null) {
  const container = document.createElement("div");
  container.className = isError ? "error-state" : "load-state";
  container.setAttribute("role", isError ? "alert" : "status");
  container.append(document.createTextNode(message));

  if (isError && retryNumber !== null) {
    const retry = createTextElement("button", "retry-button", "Coba lagi");
    retry.type = "button";
    retry.addEventListener("click", () => loadSurah(retryNumber));
    container.append(document.createElement("br"), retry);
  }

  elements.readingPanel.replaceChildren(container);
}

async function loadSurahList() {
  elements.surahListStatus.textContent = "Memuat daftar surat…";
  elements.surahCount.textContent = "Memuat";

  try {
    const data = await fetchApi("/surat");
    if (!Array.isArray(data)) throw new Error("Format daftar surat dari API tidak sesuai.");
    state.surahs = data;
    renderSurahList();
    elements.surahCount.textContent = `${data.length} surat`;
    elements.surahListStatus.textContent = "Pilih surat untuk membaca ayatnya.";
  } catch (error) {
    elements.surahCount.textContent = "Gagal memuat";
    elements.surahListStatus.textContent = `Daftar surat tidak dapat dimuat: ${error.message}`;
  }
}

function renderSurahList() {
  const query = elements.surahSearch.value.trim().toLocaleLowerCase("id");
  const filteredSurahs = state.surahs.filter((surah) =>
    `${surah.namaLatin} ${surah.arti} ${surah.nomor}`.toLocaleLowerCase("id").includes(query),
  );
  const fragment = document.createDocumentFragment();

  filteredSurahs.forEach((surah) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "surah-option";
    if (surah.nomor === state.selectedSurahNumber) button.classList.add("is-selected");
    button.setAttribute("aria-pressed", String(surah.nomor === state.selectedSurahNumber));

    const number = createTextElement("span", "surah-index", String(surah.nomor));
    const info = document.createElement("span");
    info.className = "surah-info";
    info.append(
      createTextElement("strong", "", surah.namaLatin),
      createTextElement("span", "", `${surah.jumlahAyat} ayat · ${surah.arti}`),
    );
    const arabicName = createTextElement("span", "surah-arabic", surah.nama);
    arabicName.lang = "ar";
    arabicName.dir = "rtl";
    button.append(number, info, arabicName);
    button.addEventListener("click", () => loadSurah(surah.nomor));
    fragment.append(button);
  });

  elements.surahList.replaceChildren(fragment);
  if (filteredSurahs.length === 0) {
    elements.surahListStatus.textContent = query ? "Surat tidak ditemukan." : "Daftar surat kosong.";
  } else {
    elements.surahListStatus.textContent = query
      ? `${filteredSurahs.length} surat ditemukan.`
      : "Pilih surat untuk membaca ayatnya.";
  }
}

async function loadSurah(number) {
  state.loadingSurahNumber = number;
  state.selectedSurahNumber = number;
  renderSurahList();
  setReadingMessage("Memuat surat dan ayat…");

  try {
    const data = await fetchApi(`/surat/${number}`);
    if (!Array.isArray(data.ayat)) throw new Error("Data ayat surat tidak tersedia pada respons API.");
    state.selectedSurah = data;
    state.loadingSurahNumber = null;
    renderSurahList();
    renderSurah(data);
    updateSelectedSurahLabel();
    renderQuestion();
  } catch (error) {
    state.loadingSurahNumber = null;
    state.selectedSurah = null;
    state.selectedSurahNumber = null;
    renderSurahList();
    setReadingMessage(`Surat tidak dapat dimuat. Periksa koneksi internet lalu coba lagi. (${error.message})`, true, number);
    updateSelectedSurahLabel();
    showQuizMessage("Surat belum tersedia", "Muat surat dari menu Al-Qur’an sebelum memulai latihan.");
  }
}

function renderSurah(surah) {
  const header = document.createElement("header");
  header.className = "surah-title";
  const titleBlock = document.createElement("div");
  titleBlock.append(
    createTextElement("h2", "", surah.namaLatin),
    createTextElement("p", "", `Surat ke-${surah.nomor} · ${surah.jumlahAyat} ayat · ${surah.tempatTurun}`),
  );
  const arabicTitle = createTextElement("span", "surah-title-arabic", surah.nama);
  arabicTitle.lang = "ar";
  arabicTitle.dir = "rtl";
  header.append(titleBlock, arabicTitle);

  const verseList = document.createElement("div");
  verseList.className = "verse-list";
  surah.ayat.forEach((ayah) => {
    const verse = document.createElement("article");
    verse.className = "verse";
    verse.append(createTextElement("span", "verse-number", String(ayah.nomorAyat)));

    const content = document.createElement("div");
    content.className = "verse-content";
    const arabic = createTextElement("p", "verse-arabic", ayah.teksArab || "");
    arabic.lang = "ar";
    arabic.dir = "rtl";
    content.append(arabic);
    if (typeof ayah.teksIndonesia === "string" && ayah.teksIndonesia.trim()) {
      content.append(createTextElement("p", "verse-translation", ayah.teksIndonesia));
    }
    verse.append(content);
    verseList.append(verse);
  });

  elements.readingPanel.replaceChildren(header, createSurahAudio(surah), verseList);
}

function createSurahAudio(surah) {
  const audioPanel = document.createElement("section");
  audioPanel.className = "surah-audio";
  audioPanel.setAttribute("aria-label", `Audio surat ${surah.namaLatin}`);

  const tracks = Object.entries(surah.audioFull || {}).filter(([, url]) => typeof url === "string" && url.trim());
  if (tracks.length === 0) {
    audioPanel.append(createTextElement("p", "audio-unavailable", "Audio penuh tidak tersedia dari API untuk surat ini."));
    return audioPanel;
  }

  const heading = createTextElement("h3", "audio-heading", "Audio surat penuh");
  const label = document.createElement("label");
  label.className = "audio-label";
  label.append(createTextElement("span", "", "Pilih qari"));

  const select = document.createElement("select");
  select.className = "audio-select";
  select.setAttribute("aria-label", "Pilih qari");
  tracks.forEach(([key, url]) => {
    const option = document.createElement("option");
    option.value = url;
    option.textContent = getReciterName(url, key);
    select.append(option);
  });
  label.append(select);

  const audio = document.createElement("audio");
  audio.controls = true;
  audio.preload = "none";
  audio.src = tracks[0][1];
  audio.setAttribute("aria-label", `Audio penuh surat ${surah.namaLatin}`);

  const status = createTextElement("p", "audio-status", "Pilih qari, lalu tekan putar.");
  status.setAttribute("role", "status");
  select.addEventListener("change", () => {
    audio.src = select.value;
    audio.load();
    status.textContent = `Qari dipilih: ${select.selectedOptions[0].textContent}.`;
  });
  audio.addEventListener("error", () => {
    status.textContent = "Audio tidak dapat dimuat. Periksa koneksi internet lalu coba qari lain.";
  });

  audioPanel.append(heading, label, audio, status);
  return audioPanel;
}

function getReciterName(audioUrl, key) {
  try {
    const pathParts = new URL(audioUrl).pathname.split("/").filter(Boolean);
    const audioFolderIndex = pathParts.indexOf("audio-full");
    const reciterSlug = pathParts[audioFolderIndex + 1];
    if (reciterSlug) {
      return reciterSlug.split("-").map((part) => part[0].toUpperCase() + part.slice(1)).join(" ");
    }
  } catch {
    return `Qari ${key}`;
  }
  return `Qari ${key}`;
}

function updateSelectedSurahLabel() {
  elements.selectedSurahLabel.textContent = state.selectedSurah
    ? `Surat aktif: ${state.selectedSurah.namaLatin}`
    : "Pilih surat dari menu Al-Qur’an";
}

function shuffle(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled;
}

function getDistinctVerses(verses, excludedNumbers = new Set()) {
  const seenNumbers = new Set();
  return verses.filter((ayah) => {
    if (!Number.isInteger(ayah.nomorAyat) || !ayah.teksArab || excludedNumbers.has(ayah.nomorAyat)) return false;
    if (seenNumbers.has(ayah.nomorAyat)) return false;
    seenNumbers.add(ayah.nomorAyat);
    return true;
  });
}

function makeGuessOptions(verses, correctAyah) {
  const distractors = getDistinctVerses(verses, new Set([correctAyah.nomorAyat]));
  if (distractors.length < 2) return null;
  return shuffle([
    { label: String(correctAyah.nomorAyat), correct: true },
    ...shuffle(distractors).slice(0, 2).map((ayah) => ({ label: String(ayah.nomorAyat), correct: false })),
  ]);
}

function makeContinuationQuestion(verses) {
  const usableVerses = getDistinctVerses(verses);
  const possiblePrompts = usableVerses.filter((ayah) =>
    usableVerses.some((candidate) => candidate.nomorAyat === ayah.nomorAyat + 1),
  );

  for (const prompt of shuffle(possiblePrompts)) {
    const correctAyah = usableVerses.find((ayah) => ayah.nomorAyat === prompt.nomorAyat + 1);
    const wrongAnswers = usableVerses.filter((ayah) =>
      ayah.nomorAyat !== prompt.nomorAyat && ayah.nomorAyat !== correctAyah.nomorAyat && ayah.teksArab !== correctAyah.teksArab,
    );
    const uniqueWrongAnswers = [...new Map(wrongAnswers.map((ayah) => [ayah.teksArab, ayah])).values()];
    if (uniqueWrongAnswers.length < 2) continue;

    return {
      prompt,
      correctAyah,
      options: shuffle([
        { label: correctAyah.teksArab, correct: true },
        ...shuffle(uniqueWrongAnswers).slice(0, 2).map((ayah) => ({ label: ayah.teksArab, correct: false })),
      ]),
    };
  }
  return null;
}

function createQuestion() {
  const verses = state.selectedSurah?.ayat;
  if (!Array.isArray(verses) || verses.length < 4) {
    return { error: "Surat ini memiliki kurang dari empat ayat. Pilih surat lain dengan minimal empat ayat untuk membuat tiga pilihan yang berbeda." };
  }

  const usableVerses = getDistinctVerses(verses);
  if (state.mode === "guess") {
    const possibleAnswers = shuffle(usableVerses).map((ayah) => ({
      ayah,
      options: makeGuessOptions(usableVerses, ayah),
    })).filter((item) => item.options);
    if (possibleAnswers.length === 0) {
      return { error: "Belum tersedia tiga nomor ayat yang berbeda untuk soal ini. Pilih surat lain." };
    }
    const chosen = possibleAnswers[0];
    return { type: "guess", prompt: chosen.ayah, correctAyah: chosen.ayah, options: chosen.options };
  }

  const continuationQuestion = makeContinuationQuestion(usableVerses);
  if (!continuationQuestion) {
    return { error: "Belum tersedia tiga teks ayat berbeda untuk soal sambung. Pilih surat lain." };
  }
  return { type: "continue", ...continuationQuestion };
}

function showQuizMessage(title, message) {
  const box = document.createElement("div");
  box.className = "quiz-message";
  box.append(
    createTextElement("p", "eyebrow", "Mentor Murajaah"),
    createTextElement("h3", "", title),
    createTextElement("p", "", message),
  );
  elements.quizArea.replaceChildren(box);
  elements.nextQuestion.disabled = true;
}

function renderQuestion() {
  if (!state.selectedSurah) {
    showQuizMessage("Siap untuk murajaah?", "Pilih surat terlebih dahulu di menu Al-Qur’an. Latihan akan memakai ayat dari surat tersebut.");
    return;
  }

  state.question = createQuestion();
  state.answered = false;
  elements.nextQuestion.disabled = true;
  if (state.question.error) {
    showQuizMessage("Pilih surat lain", state.question.error);
    return;
  }

  const question = state.question;
  const wrapper = document.createElement("div");
  const meta = document.createElement("div");
  meta.className = "question-meta";
  meta.append(createTextElement("strong", "", state.mode === "guess" ? "TEBAK AYAT" : "SAMBUNG AYAT"));
  meta.append(document.createTextNode(` · ${state.selectedSurah.namaLatin}`));

  const prompt = createTextElement("p", "question-prompt", question.prompt.teksArab);
  prompt.lang = "ar";
  prompt.dir = "rtl";
  const instruction = createTextElement("p", "question-meta", state.mode === "guess" ? "Pilih nomor ayat yang tepat." : "Pilih ayat yang tepat sesudahnya.");
  const answerList = document.createElement("div");
  answerList.className = "answer-list";
  const feedback = createTextElement("p", "feedback", "");
  feedback.setAttribute("role", "status");

  question.options.forEach((option) => {
    const button = createTextElement("button", `answer-option ${state.mode === "guess" ? "number-option" : "arabic-option"}`, option.label);
    button.type = "button";
    if (state.mode === "continue") button.lang = "ar";
    button.addEventListener("click", () => selectAnswer(option, answerList, feedback));
    answerList.append(button);
  });

  wrapper.append(meta, prompt, instruction, answerList, feedback);
  elements.quizArea.replaceChildren(wrapper);
}

function selectAnswer(selectedOption, answerList, feedback) {
  if (state.answered) return;
  state.answered = true;
  const buttons = [...answerList.querySelectorAll(".answer-option")];
  buttons.forEach((button, index) => {
    const option = state.question.options[index];
    button.disabled = true;
    if (option.correct) button.classList.add("is-correct");
    else if (option === selectedOption) button.classList.add("is-wrong");
  });

  if (selectedOption.correct) {
    state.score += 10;
    elements.scoreValue.textContent = String(state.score);
    feedback.textContent = "Tepat! Skor bertambah 10 poin.";
    feedback.classList.add("is-correct");
  } else {
    feedback.textContent = "Belum tepat. Perhatikan pilihan yang ditandai hijau.";
    feedback.classList.add("is-wrong");
  }
  elements.nextQuestion.disabled = false;
}

function restartQuiz() {
  state.score = 0;
  elements.scoreValue.textContent = "0";
  renderQuestion();
}

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-view]").forEach((tab) => {
      const active = tab === button;
      tab.classList.toggle("is-active", active);
      if (active) tab.setAttribute("aria-current", "page");
      else tab.removeAttribute("aria-current");
    });

    const showQuran = button.dataset.view === "quran";
    document.querySelector("#quran-view").classList.toggle("is-active", showQuran);
    document.querySelector("#quran-view").hidden = !showQuran;
    document.querySelector("#mentor-view").classList.toggle("is-active", !showQuran);
    document.querySelector("#mentor-view").hidden = showQuran;
  });
});

document.querySelectorAll("[data-mode]").forEach((button) => {
  button.addEventListener("click", () => {
    state.mode = button.dataset.mode;
    document.querySelectorAll("[data-mode]").forEach((modeButton) => {
      const active = modeButton === button;
      modeButton.classList.toggle("is-active", active);
      modeButton.setAttribute("aria-pressed", String(active));
    });
    renderQuestion();
  });
});

elements.surahSearch.addEventListener("input", renderSurahList);
elements.nextQuestion.addEventListener("click", renderQuestion);
elements.restartQuiz.addEventListener("click", restartQuiz);
document.querySelector("[data-go-quran]").addEventListener("click", () => {
  document.querySelector('[data-view="quran"]').click();
  elements.surahSearch.focus();
});

loadSurahList();