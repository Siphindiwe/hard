import { firebaseConfig } from './firebase-keys.js'

let db

if (typeof firebaseConfig === 'undefined') {
  console.error(
    "Firebase configuration object 'firebaseConfig' is not found. " +
      "Ensure 'firebase-keys.js' is correctly set up and loaded before this script."
  )
} else {
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig)
      console.log('Firebase initialized successfully in database.js.')
    } else {
      firebase.app()
      console.log('Firebase was already initialized when database.js loaded.')
    }
    db = firebase.firestore()
    console.log('Firestore initialized successfully in database.js.')
  } catch (e) {
    console.error('Error initializing Firebase or Firestore in database.js:', e)
  }
}

/**
 * Updates (creates or overwrites) multiple question documents for a specific user and category.
 * @param {string} uid - The user ID.
 * @param {string} categoryKey - The category key (e.g., "Web Development"), which will be the collection name under the user.
 * @param {Array<Object>} questions - An array of question objects. Each should have an 'id'.
 * @returns {Promise<Object>} A promise that resolves with an object: { status: 'success'/'error', message: 'user-friendly message' }
 */
async function updateQuestions(uid, categoryKey, questions) {
  if (!db) {
    console.error(
      'DB_ERROR: Firestore database (db) is not initialized for updateQuestions.'
    )
    return {
      status: 'error',
      message:
        'Database connection error. Please try again later or contact support.',
    }
  }
  if (!uid || typeof uid !== 'string' || uid.trim() === '') {
    console.error('INPUT_ERROR: Invalid UID provided for updateQuestions.')
    return {
      status: 'error',
      message: 'User identification is missing for updating questions.',
    }
  }
  if (
    !categoryKey ||
    typeof categoryKey !== 'string' ||
    categoryKey.trim() === ''
  ) {
    console.error(
      'INPUT_ERROR: Invalid category key provided for updateQuestions.'
    )
    return {
      status: 'error',
      message: 'Quiz category is missing for updating questions.',
    }
  }
  if (!Array.isArray(questions)) {
    console.error(
      'INPUT_ERROR: Questions data must be an array for updateQuestions.'
    )
    return {
      status: 'error',
      message:
        'Invalid questions format. Please ensure it is a list of questions.',
    }
  }

  // Corrected Firestore path: users/{uid}/{categoryKey}
  // This path refers to a collection named after the categoryKey, directly under the user's document.
  // Example: 'users/someUID/Web Development' - this has 3 segments, valid for a collection.
  const firestoreCollectionPath = `users/${uid}/${categoryKey}`
  console.log(
    `Constructed Firestore collection path for updateQuestions: ${firestoreCollectionPath}`
  )

  const batch = db.batch()
  let validQuestionsCount = 0

  for (const question of questions) {
    if (
      !question.id ||
      typeof question.id !== 'string' ||
      question.id.trim() === ''
    ) {
      console.warn(
        'SKIPPING_QUESTION: Question skipped in updateQuestions due to missing or invalid ID:',
        question
      )
      continue
    }
    // Get a reference to a document within the specified collection
    const questionRef = db.collection(firestoreCollectionPath).doc(question.id)
    batch.set(questionRef, question)
    validQuestionsCount++
  }

  if (validQuestionsCount === 0 && questions.length > 0) {
    return {
      status: 'error',
      message: 'No valid questions with IDs found to update.',
    }
  }
  if (validQuestionsCount === 0 && questions.length === 0) {
    return {
      status: 'success',
      message: 'No questions provided to update.',
    }
  }

  try {
    await batch.commit()
    console.log(
      `Successfully updated/created ${validQuestionsCount} questions in '${firestoreCollectionPath}'.`
    )
    return {
      status: 'success',
      message: `Successfully updated ${validQuestionsCount} questions for category '${categoryKey}'.`,
    }
  } catch (error) {
    console.error(
      `FIRESTORE_ERROR: Error updating questions in '${firestoreCollectionPath}':`,
      error
    )
    return {
      status: 'error',
      message:
        'Could not save questions. Please check your connection and try again.',
    }
  }
}

/**
 * Retrieves questions for a specific user and category.
 * If questions don't exist in Firestore for that user/category, it initializes them from 'init-data.json'.
 * @param {string} uid - The user ID.
 * @param {string} categoryKey - The category key (e.g., "Web Development"), which is also the key in 'init-data.json'
 * and will be used as the collection name under the user's document.
 * @returns {Promise<Object>} A promise that resolves with an object: { status: 'success'/'error', message: 'user-friendly message', data?: Array<Object> }
 */
async function getQuestions(uid, categoryKey) {
  if (!db) {
    console.error(
      'DB_ERROR: Firestore database (db) is not initialized for getQuestions.'
    )
    return {
      status: 'error',
      message:
        'Database connection error. Please try again later or contact support.',
    }
  }
  if (!uid || typeof uid !== 'string' || uid.trim() === '') {
    console.error('INPUT_ERROR: Invalid UID provided for getQuestions.')
    return {
      status: 'error',
      message: 'User identification is missing for fetching questions.',
    }
  }
  if (
    !categoryKey ||
    typeof categoryKey !== 'string' ||
    categoryKey.trim() === ''
  ) {
    console.error(
      'INPUT_ERROR: Invalid category key provided for getQuestions.'
    )
    return {
      status: 'error',
      message: 'Cannot determine which quiz category to load.',
    }
  }

  // Corrected Firestore path: users/{uid}/{categoryKey}
  // This path refers to a collection named after the categoryKey, directly under the user's document.
  const userCategoryQuestionsCollectionPath = `users/${uid}/${categoryKey}`
  console.log(
    `Constructed Firestore collection path for getQuestions: ${userCategoryQuestionsCollectionPath}`
  )

  try {
    const snapshot = await db
      .collection(userCategoryQuestionsCollectionPath)
      .get()
    let questionsFromDb = []
    snapshot.forEach((doc) => {
      questionsFromDb.push({ id: doc.id, ...doc.data() })
    })

    if (questionsFromDb.length === 0) {
      console.log(
        `No questions found in Firestore for path '${userCategoryQuestionsCollectionPath}'. Initializing from init-data.json for category '${categoryKey}'...`
      )

      let initData
      try {
        const response = await fetch('./init-data.json') // Ensure this path is correct
        if (!response.ok) {
          throw new Error(
            `HTTP error! status: ${response.status}, message: ${response.statusText}`
          )
        }
        initData = await response.json()
      } catch (fetchError) {
        console.error(
          "FETCH_ERROR: Failed to load 'init-data.json':",
          fetchError
        )
        return {
          status: 'error',
          message: `Failed to load initial question data file. (${fetchError.message})`,
        }
      }

      const questionsToLoad = initData[categoryKey]

      if (!questionsToLoad || !Array.isArray(questionsToLoad)) {
        console.error(
          `JSON_DATA_ERROR: No questions found or invalid format in init-data.json for category: '${categoryKey}'`
        )
        return {
          status: 'error',
          message: `Initial questions for '${categoryKey}' are missing or not in the correct format in the data file.`,
        }
      }
      if (questionsToLoad.length === 0) {
        console.warn(
          `JSON_DATA_WARN: Zero questions found in init-data.json for category: '${categoryKey}'`
        )
        return {
          status: 'success',
          message: `No initial questions available for '${categoryKey}'.`,
          data: [],
        }
      }

      console.log(
        `Attempting to save ${questionsToLoad.length} questions to '${userCategoryQuestionsCollectionPath}'`
      )
      // Call updateQuestions with uid, categoryKey, and the questions to load
      const updateResult = await updateQuestions(
        uid,
        categoryKey,
        questionsToLoad
      )

      if (updateResult.status === 'success') {
        console.log(
          `Successfully initialized questions for '${userCategoryQuestionsCollectionPath}' in Firestore.`
        )
        return {
          status: 'success',
          message: 'Initial questions loaded and saved successfully.',
          data: questionsToLoad,
        }
      } else {
        console.error(
          `UPDATE_DB_ERROR: Failed to save initial questions to Firestore for '${userCategoryQuestionsCollectionPath}': ${updateResult.message}`
        )
        return {
          status: 'error',
          message: `Failed to save initial questions to your account: ${updateResult.message}`,
        }
      }
    } else {
      console.log(
        `Successfully retrieved ${questionsFromDb.length} questions from Firestore path '${userCategoryQuestionsCollectionPath}'.`
      )
      return {
        status: 'success',
        message: 'Questions loaded successfully from your account.',
        data: questionsFromDb,
      }
    }
  } catch (error) {
    console.error(
      `FIRESTORE_ERROR: General error in getQuestions for path '${userCategoryQuestionsCollectionPath}':`,
      error
    )
    let userMessage =
      'Could not load questions. Please check your connection and try again.'
    if (error.code === 'permission-denied') {
      userMessage =
        'You do not have permission to access these questions. Please contact support.'
    } else if (
      error.message &&
      error.message.includes('Invalid collection reference')
    ) {
      // This specific check might be redundant if the path is now always correct, but good for debugging
      userMessage =
        'There was an issue with the database path. Please report this error.'
    }
    return {
      status: 'error',
      message: userMessage,
    }
  }
}

/**
 * Adds a new score entry to the "scores" collection.
 * @param {string} uid - The user ID.
 * @param {number} score - The score achieved by the user.
 * @param {string} category - The category of the quiz.
 * @returns {Promise<Object>} A promise that resolves with an object: { status: 'success'/'error', message: 'user-friendly message', data?: { scoreId: string } }
 */
async function addScore(uid, score, category) {
  if (!db) {
    console.error(
      'DB_ERROR: Firestore database (db) is not initialized for addScore.'
    )
    return {
      status: 'error',
      message:
        'Database connection error. Please try again later or contact support.',
    }
  }
  if (typeof uid !== 'string' || uid.trim() === '') {
    console.error('INPUT_ERROR: Invalid UID for addScore.')
    return {
      status: 'error',
      message: 'Invalid user identifier for saving score.',
    }
  }
  if (typeof score !== 'number') {
    console.error('INPUT_ERROR: Invalid score value for addScore.')
    return { status: 'error', message: 'Invalid score value provided.' }
  }
  if (typeof category !== 'string' || category.trim() === '') {
    console.error('INPUT_ERROR: Invalid category for addScore.')
    return {
      status: 'error',
      message: 'Invalid quiz category for saving score.',
    }
  }

  try {
    const scoreData = {
      uid: uid,
      score: score,
      category: category,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    }
    const docRef = await db.collection('scores').add(scoreData) // "scores" is a root collection
    console.log(
      `Score added for UID ${uid} in category '${category}' with ID: ${docRef.id}.`
    )
    return {
      status: 'success',
      message: 'Your score has been saved successfully!',
      data: { scoreId: docRef.id },
    }
  } catch (error) {
    console.error(`FIRESTORE_ERROR: Error adding score for UID ${uid}:`, error)
    return {
      status: 'error',
      message:
        'Could not save your score. Please check your connection and try again.',
    }
  }
}

/**
 * Retrieves the top score for a given user in a specific category.
 * @param {string} uid - The user ID.
 * @param {string} category - The quiz category.
 * @returns {Promise<Object>} A promise that resolves with an object: { status: 'success'/'error', message: 'user-friendly message', data?: Object|null }
 */
async function getUserTopScore(uid, category) {
  if (!db) {
    console.error(
      'DB_ERROR: Firestore database (db) is not initialized for getUserTopScore.'
    )
    return {
      status: 'error',
      message:
        'Database connection error. Please try again later or contact support.',
    }
  }
  if (typeof uid !== 'string' || uid.trim() === '') {
    console.error('INPUT_ERROR: Invalid UID provided for getUserTopScore.')
    return {
      status: 'error',
      message: 'Invalid user identifier for fetching score.',
    }
  }
  if (typeof category !== 'string' || category.trim() === '') {
    console.error('INPUT_ERROR: Invalid category provided for getUserTopScore.')
    return {
      status: 'error',
      message: 'Invalid quiz category for fetching score.',
    }
  }

  try {
    // "scores" is a root collection
    const snapshot = await db
      .collection('scores')
      .where('uid', '==', uid)
      .where('category', '==', category)
      .orderBy('score', 'desc')
      .limit(1)
      .get()

    if (snapshot.empty) {
      console.log(`No scores found for UID ${uid} in category '${category}'.`)
      return {
        status: 'success',
        message: 'No scores recorded for you in this category yet.',
        data: null,
      }
    }

    const doc = snapshot.docs[0]
    const topScoreData = { id: doc.id, ...doc.data() }
    console.log(
      `Successfully retrieved top score for UID ${uid} in category '${category}':`,
      topScoreData
    )
    return {
      status: 'success',
      message: 'Your top score was retrieved successfully.',
      data: topScoreData,
    }
  } catch (error) {
    console.error(
      `FIRESTORE_ERROR: Error getting top score for UID ${uid} in category '${category}':`,
      error
    )
    return {
      status: 'error',
      message:
        'Could not retrieve your top score. Please check your connection and try again.',
    }
  }
}

export { updateQuestions, getQuestions, addScore, getUserTopScore }
