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
  soundToggle: document.querySelector('#sound-toggle'),
  soundLabel: document.querySelector('#sound-label'),
  panelKicker: document.querySelector('#panel-kicker'),
};

let questions = [];
let currentIndex = 0;
let selectedIndex = null;
let answerSubmitted = false;
let score = 0;
let playerName = '';
let audioContext = null;
let soundEnabled = localStorage.getItem(SOUND_KEY) !== 'off';

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
  if (answerSubmitted) return;
  selectedIndex = optionIndex;
  [...elements.answers.children].forEach((button, index) => {
    button.setAttribute('aria-pressed', String(index === optionIndex));
  });
  elements.submit.disabled = false;
}

function submitAnswer() {
  if (selectedIndex === null || answerSubmitted) return;

  answerSubmitted = true;
  const question = questions[currentIndex];
  const correct = selectedIndex === question.answerIndex;

  if (correct) score += 1;

  [...elements.answers.children].forEach((button, index) => {
    button.disabled = true;
    if (index === question.answerIndex) button.classList.add('is-correct');
    else if (index === selectedIndex) button.classList.add('is-wrong');
  });

  elements.feedback.textContent = correct
    ? 'Isso aí! Resposta certa!'
    : `Quase! A resposta certa é ${OPTION_LETTERS[question.answerIndex]}.`;
  elements.feedback.className = `feedback ${correct ? 'correct' : 'wrong'}`;

  elements.submit.disabled = false;
  elements.submit.innerHTML =
    currentIndex === questions.length - 1
      ? 'Ver resultado <span aria-hidden="true">→</span>'
      : 'Próxima pergunta <span aria-hidden="true">→</span>';

  playSound(correct ? 'correct' : 'wrong');
}

function finishQuiz() {
  const ratio = score / questions.length;
  const message =
    ratio === 1
      ? 'Você arrasou! Acertou todas as perguntas e mostrou que conhece a história e a música da Preta Gil com muita atenção.'
      : ratio >= 0.7
        ? 'Muito bem! Você foi muito bom no quiz e está no caminho de conhecer ainda mais essa trajetória incrível.'
        : ratio >= 0.4
          ? 'Parabéns por participar! Você acertou algumas perguntas, continue assim.'
          : 'Continue explorando!';

  const callToAction =
    'Agora é a hora de visitar a barraca do 7º ano e descobrir mais sobre essa história na Feira Cultural!';

  if (elements.resultName) {
    elements.resultName.textContent = playerName.toLocaleUpperCase('pt-BR');
  }
  if (elements.resultScore) {
    elements.resultScore.innerHTML = `${score} <span>/ ${questions.length}</span>`;
  }
  if (elements.resultMessage) {
    elements.resultMessage.textContent = `${message} ${callToAction}`;
  }
  setScreen('result');
  playSound('finish');
}

function handleSubmitClick() {
  if (!questions.length) return;

  if (!answerSubmitted) {
    submitAnswer();
    return;
  }

  if (currentIndex < questions.length - 1) {
    currentIndex += 1;
    renderQuestion();
    elements.title.focus();
    return;
  }

  finishQuiz();
}

elements.form.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = elements.name.value.trim();
  if (!name) {
    elements.name.focus();
    return;
  }

  playerName = name;
  score = 0;
  currentIndex = 0;
  selectedIndex = null;
  answerSubmitted = false;

  elements.greeting.textContent = `VAMOS, ${name.toLocaleUpperCase('pt-BR')}!`;
  setScreen('question');
  renderQuestion();
  elements.title.focus();
});

elements.submit.addEventListener('click', handleSubmitClick);
elements.restart.addEventListener('click', () => {
  playerName = '';
  score = 0;
  currentIndex = 0;
  selectedIndex = null;
  answerSubmitted = false;
  elements.name.value = '';
  setScreen('welcome');
  elements.name.focus();
});
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
  elements.participantCount.textContent = '0';
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
