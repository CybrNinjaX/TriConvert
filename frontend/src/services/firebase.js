import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: 'AIzaSyCzwpTil0bV0ex2TTE4nFsFLf3zyagER1o',
  authDomain: 'triconvert.firebaseapp.com',
  projectId: 'triconvert',
  storageBucket: 'triconvert.firebasestorage.app',
  messagingSenderId: '485874732813',
  appId: '1:485874732813:web:8fb800ac4f86bb5eae6a44',
  measurementId: 'G-SY15YSPF7V',
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
