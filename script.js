let currentQuestion = 0
let score = 0
let quizQuestions = []
let quizData = {}
let timer
let timeLeft = 15
let selectedTopic = ''

const startScreen = document.getElementById('start-screen')
const quizContainer = document.getElementById('quiz-container')
const startBtn = document.getElementById('start-btn')
const categoryCards = document.querySelectorAll('.category-card')

const questionText = document.getElementById('question-text')
const questionNumber = document.getElementById('question-number')
const optionsContainer = document.getElementById('options-container')
const scoreDisplay = document.getElementById('score')
const nextBtn = document.getElementById('next-btn')
const timerDisplay = document.getElementById('timer')
const progressBar = document.querySelector('.progress-bar')
const quizTopicDisplay = document.getElementById('quiz-topic')

import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js'
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
} from 'https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js'
import { firebaseConfig } from './firebase-keys.js'

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

async function getQuizQuestions(category) {
  try {
    const questionsRef = collection(db, 'questions')
    const q = query(questionsRef, where('category', '==', category))

    const querySnapshot = await getDocs(q)
    const questions = []

    querySnapshot.forEach((doc) => {
      questions.push(doc.data())
    })

    return shuffleArray(questions).slice(0, 10)
  } catch (error) {
    console.error('Error getting questions: ', error)
    return []
  }
}

startBtn.onclick = async () => {
  if (!selectedTopic) return alert('Please select a category.')

  quizQuestions = await getQuizQuestions(selectedTopic)
  if (quizQuestions.length === 0) {
    return alert(
      'No questions found for this category. Please try another one.'
    )
  }

  currentQuestion = 0
  score = 0

  scoreDisplay.textContent = 'Score: 0'
  progressBar.style.width = '0%'
  nextBtn.style.display = 'inline-block'
  startScreen.style.display = 'none'
  quizContainer.style.display = 'block'
  quizTopicDisplay.textContent = selectedTopic

  loadQuestion()
}

function shuffleArray(array) {
  return [...array].sort(() => Math.random() - 0.5)
}

function loadQuestion() {
  clearInterval(timer)
  timeLeft = 15
  updateTimerDisplay()

  const q = quizQuestions[currentQuestion]
  questionText.textContent = q.question
  questionNumber.textContent = `Question ${currentQuestion + 1} of ${
    quizQuestions.length
  }`
  optionsContainer.innerHTML = ''
  nextBtn.disabled = true

  q.choices.forEach((choice) => {
    const btn = document.createElement('button')
    btn.textContent = choice
    btn.className = 'option-btn'
    btn.onclick = () => handleAnswer(btn, choice)
    optionsContainer.appendChild(btn)
  })

  startTimer()
}

function handleAnswer(button, selected) {
  clearInterval(timer)
  const q = quizQuestions[currentQuestion]
  const isCorrect = selected === q.answer

  if (isCorrect) {
    button.style.backgroundColor = '#a8e6a1'
    score++
    scoreDisplay.textContent = `Score: ${score}`
  } else {
    button.style.backgroundColor = '#f8a1a1'
    ;[...optionsContainer.children].find(
      (btn) => btn.textContent === q.answer
    ).style.backgroundColor = '#a8e6a1'
  }

  ;[...optionsContainer.children].forEach((btn) => (btn.disabled = true))
  nextBtn.disabled = false
}

nextBtn.onclick = () => {
  currentQuestion++
  if (currentQuestion < quizQuestions.length) {
    updateProgress()
    loadQuestion()
  } else {
    showFinalScore()
  }
}

function updateProgress() {
  const percent = (currentQuestion / quizQuestions.length) * 100
  progressBar.style.width = `${percent}%`
}

function startTimer() {
  timerDisplay.textContent = `Time Left: ${timeLeft}s`
  timer = setInterval(() => {
    timeLeft--
    updateTimerDisplay()

    if (timeLeft === 0) {
      clearInterval(timer)
      autoFailQuestion()
    }
  }, 1000)
}

function updateTimerDisplay() {
  timerDisplay.textContent = `Time Left: ${timeLeft}s`
}

function autoFailQuestion() {
  const q = quizQuestions[currentQuestion]
  const correctBtn = [...optionsContainer.children].find(
    (btn) => btn.textContent === q.answer
  )
  correctBtn.style.backgroundColor = '#a8e6a1'
  ;[...optionsContainer.children].forEach((btn) => (btn.disabled = true))
  nextBtn.disabled = false
}

function showFinalScore() {
  questionText.textContent = `Quiz Complete! Final Score: ${score}/${quizQuestions.length}`
  questionNumber.textContent = ''
  optionsContainer.innerHTML = ''
  timerDisplay.textContent = ''
  progressBar.style.width = '100%'

  nextBtn.style.display = 'none'

  const restartBtn = document.createElement('button')
  restartBtn.textContent = 'Restart'
  restartBtn.className = 'next-btn'
  restartBtn.onclick = () => {
    startScreen.style.display = 'block'
    quizContainer.style.display = 'none'
    restartBtn.remove()

    categoryCards.forEach((c) => c.classList.remove('selected'))
    selectedTopic = ''
    startBtn.disabled = true
  }
  quizContainer.appendChild(restartBtn)
}
