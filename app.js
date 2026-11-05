const DATA_KEY = 'feira-cultural-preta-gil-v1';
const SOUND_KEY = 'feira-cultural-som-v1';
const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

const elements = {
  questionCount: document.querySelector('#question-count'),
  participantCount: document.querySelector('#participant-count'),
  welcome: document.querySelector('#welcome-screen'),
  question: document.querySelector('#question-screen'),
  result: document.querySelector('#result-screen'),
  form: document.querySelector('#start-form'),
  name: document.querySelector('#player-name'),
  greeting: document.querySelector('#player-greeting'),
  position: document.querySelector('#question-position'),
  progress: document.querySelector('.progress-track'),
  progressFill: document.querySelector('#progress-fill'),
  title: document.querySelector('#question-title'),
  answers: document.querySelector('#answers'),
  feedback: document.querySelector('#feedback'),
  submit: document.querySelector('#submit-answer'),
  resultName: document.querySelector('#result-name'),
  resultScore: document.querySelector('#result-score'),
  resultMessage: document.querySelector('#result-message'),
  restart: document.querySelector('#restart-button'),
  export: document.querySelector('#export-button'),
  storageNote: document.querySelector('#storage-note'),
  soundToggle: document.querySelector('#sound-toggle'),
  soundLabel: document.querySelector('#sound-label'),
  panelKicker: document.querySelector('#panel-kicker'),
};

let questions = [];
let currentIndex = 0;
let selectedIndex = null;
let answerSubmitted = false;
let currentSession = null;
let audioContext = null;
let storageAvailable = true;
let soundEnabled = localStorage.getItem(SOUND_KEY) !== 'off';

function readDatabase() {
  try {
    const stored = JSON.parse(localStorage.getItem(DATA_KEY) || 'null');
    return stored && Array.isArray(stored.sessions)
      ? stored
      : { version: 1, sessions: [] };
  } catch {
    return { version: 1, sessions: [] };
  }
}

function saveSession() {
  if (!currentSession) return;
  try {
    const database = readDatabase();
    const sessionIndex = database.sessions.findIndex(
      (item) => item.id === currentSession.id,
    );
    if (sessionIndex === -1) database.sessions.push(currentSession);
    else database.sessions[sessionIndex] = currentSession;
    localStorage.setItem(DATA_KEY, JSON.stringify(database));
    storageAvailable = true;
  } catch {
    storageAvailable = false;
  }
  updateParticipantCount();
}

function recordEvent(type, details = {}) {
  if (!currentSession) return;
  currentSession.events.push({
    type,
    at: new Date().toISOString(),
    ...details,
  });
  saveSession();
}

function updateParticipantCount() {
  const completed = readDatabase().sessions.filter(
    (session) => session.completedAt,
  ).length;
  elements.participantCount.textContent = String(completed);
}

function setScreen(screen) {
  elements.welcome.hidden = screen !== 'welcome';
  elements.question.hidden = screen !== 'question';
  elements.result.hidden = screen !== 'result';
  const labels = {
    welcome: 'VAMOS COMEÇAR?',
    question: 'HORA DO QUIZ',
    result: 'RESULTADO FINAL',
  };
  elements.panelKicker.textContent = labels[screen];
}

function playTone(frequency, startOffset, duration, volume = 0.12) {
  if (!soundEnabled) return;
  try {
    audioContext ??= new window.AudioContext();
    if (audioContext.state === 'suspended') audioContext.resume();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const startAt = audioContext.currentTime + startOffset;
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, startAt);
    gain.gain.setValueAtTime(volume, startAt);
    gain.gain.exponentialRampToValueAtTime(0.001, startAt + duration);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration);
  } catch {
    // Audio is optional; the quiz remains fully usable if the browser blocks it.
  }
}

function playSound(kind) {
  const notes = {
    correct: [
      [660, 0, 0.16],
      [880, 0.11, 0.2],
    ],
    wrong: [[220, 0, 0.24, 0.1]],
    finish: [
      [523, 0, 0.18],
      [659, 0.14, 0.18],
      [784, 0.28, 0.3],
    ],
  };
  for (const [frequency, offset, duration, volume] of notes[kind] || []) {
    playTone(frequency, offset, duration, volume);
  }
}

function renderQuestion() {
  const question = questions[currentIndex];
  selectedIndex = null;
  answerSubmitted = false;
  elements.feedback.textContent = '';
  elements.feedback.className = 'feedback';
  elements.submit.disabled = true;
  elements.submit.innerHTML =
    currentIndex === questions.length - 1
      ? 'Finalizar quiz <span aria-hidden="true">→</span>'
      : 'Confirmar resposta <span aria-hidden="true">→</span>';
  elements.position.textContent = `${String(currentIndex + 1).padStart(2, '0')} / ${String(questions.length).padStart(2, '0')}`;
  elements.progress.setAttribute('aria-valuemax', String(questions.length));
  elements.progress.setAttribute('aria-valuenow', String(currentIndex));
  elements.progressFill.style.width = `${(currentIndex / questions.length) * 100}%`;
  elements.title.textContent = question.question;
  elements.answers.replaceChildren();

  question.options.forEach((option, optionIndex) => {
    const button = document.createElement('button');
    button.className = 'answer-option';
    button.type = 'button';
    button.setAttribute('aria-pressed', 'false');
    const letter = document.createElement('span');
    letter.className = 'answer-letter';
    letter.setAttribute('aria-hidden', 'true');
    letter.textContent = OPTION_LETTERS[optionIndex];
    const label = document.createElement('span');
    label.textContent = option;
    button.append(letter, label);
    button.addEventListener('click', () => selectAnswer(optionIndex));
    elements.answers.append(button);
  });
}

function selectAnswer(optionIndex) {
  selectedIndex = optionIndex;
  [...elements.answers.children].forEach((button, index) => {
    button.setAttribute('aria-pressed', String(index === optionIndex));
  });
  elements.submit.disabled = false;
  recordEvent('answer_option_selected', {
    questionId: questions[currentIndex].id,
    optionIndex,
  });
}

function submitAnswer() {
  if (selectedIndex === null || answerSubmitted) return;
  answerSubmitted = true;
  const question = questions[currentIndex];
  const correct = selectedIndex === question.answerIndex;
  const answeredAt = new Date().toISOString();
  const answer = {
    questionId: question.id,
    question: question.question,
    selectedIndex,
    selectedOption: question.options[selectedIndex],
    correctIndex: question.answerIndex,
    correct,
    answeredAt,
  };
  currentSession.answers.push(answer);
  if (correct) currentSession.score += 1;

  [...elements.answers.children].forEach((button, index) => {
    button.disabled = true;
    if (index === question.answerIndex) button.classList.add('is-correct');
    else if (index === selectedIndex) button.classList.add('is-wrong');
  });

  elements.feedback.textContent = correct
    ? 'Isso aí! Resposta certa!'
    : `Quase! A resposta certa é ${OPTION_LETTERS[question.answerIndex]}.`;
  elements.feedback.classList.add(correct ? 'correct' : 'wrong');
  elements.submit.innerHTML =
    currentIndex === questions.length - 1
      ? 'Ver resultado <span aria-hidden="true">→</span>'
      : 'Próxima pergunta <span aria-hidden="true">→</span>';
  recordEvent('answer_submitted', {
    questionId: question.id,
    optionIndex: selectedIndex,
    correct,
  });
  playSound(correct ? 'correct' : 'wrong');
}

function advanceQuestion() {
  elements.submit.onclick = null;
  if (currentIndex < questions.length - 1) {
    currentIndex += 1;
    renderQuestion();
    elements.title.focus();
    return;
  }
  finishQuiz();
}

function finishQuiz() {
  currentSession.completedAt = new Date().toISOString();
  currentSession.durationMs = Date.now() - currentSession.startedAtMs;
  recordEvent('quiz_completed', {
    score: currentSession.score,
    total: questions.length,
  });
  const score = currentSession.score;
  const ratio = score / questions.length;
  const message =
    ratio === 1
      ? 'Você acertou tudo. Que memória musical!'
      : ratio >= 0.7
        ? 'Mandou muito bem. Você conhece essa história!'
        : ratio >= 0.4
          ? 'Boa participação! Sempre dá para descobrir mais.'
          : 'Valeu por participar. Agora você conhece um pouco mais!';
  elements.resultName.textContent =
    currentSession.name.toLocaleUpperCase('pt-BR');
  elements.resultScore.innerHTML = `${score} <span>/ ${questions.length}</span>`;
  elements.resultMessage.textContent = message;
  elements.storageNote.textContent = storageAvailable
    ? 'Resultados salvos neste dispositivo.'
    : 'Não foi possível salvar neste dispositivo. Baixe o JSON para guardar este resultado.';
  setScreen('result');
  playSound('finish');
}

function downloadResults() {
  const database = readDatabase();
  const payload = {
    ...database,
    exportedAt: new Date().toISOString(),
    sessions:
      currentSession &&
      !database.sessions.some((item) => item.id === currentSession.id)
        ? [...database.sessions, currentSession]
        : database.sessions,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `resultados-quiz-preta-gil-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

elements.form.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = elements.name.value.trim();
  if (!name) {
    elements.name.focus();
    return;
  }
  currentIndex = 0;
  currentSession = {
    id: crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name,
    startedAt: new Date().toISOString(),
    startedAtMs: Date.now(),
    completedAt: null,
    durationMs: null,
    score: 0,
    total: questions.length,
    answers: [],
    events: [],
  };
  recordEvent('quiz_started');
  elements.greeting.textContent = `VAMOS, ${name.toLocaleUpperCase('pt-BR')}!`;
  setScreen('question');
  renderQuestion();
  elements.title.focus();
});

elements.submit.addEventListener('click', () => {
  if (answerSubmitted) advanceQuestion();
  else submitAnswer();
});
elements.restart.addEventListener('click', () => {
  currentSession = null;
  elements.name.value = '';
  setScreen('welcome');
  elements.name.focus();
});
elements.export.addEventListener('click', downloadResults);
elements.soundToggle.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  elements.soundToggle.setAttribute('aria-pressed', String(soundEnabled));
  elements.soundLabel.textContent = soundEnabled
    ? 'Som ligado'
    : 'Som desligado';
  localStorage.setItem(SOUND_KEY, soundEnabled ? 'on' : 'off');
  if (soundEnabled) playSound('correct');
});

async function initialize() {
  elements.soundToggle.setAttribute('aria-pressed', String(soundEnabled));
  elements.soundLabel.textContent = soundEnabled
    ? 'Som ligado'
    : 'Som desligado';
  updateParticipantCount();
  try {
    const response = await fetch('./questions.json');
    if (!response.ok)
      throw new Error('Não foi possível carregar as perguntas.');
    questions = await response.json();
    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error('O arquivo de perguntas está vazio ou inválido.');
    }
    elements.questionCount.textContent = String(questions.length);
  } catch (error) {
    elements.form.hidden = true;
    const message = document.createElement('p');
    message.className = 'feedback wrong';
    message.textContent =
      'Não foi possível carregar as perguntas. Abra o site por um servidor local.';
    elements.welcome.append(message);
    console.error(error);
  }
}

initialize();
