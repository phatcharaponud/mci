import { useState, useEffect } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

export default function useAuth() {
  var _u = useState(null);
  var user = _u[0];
  var setUser = _u[1];
  var _l = useState(true);
  var loading = _l[0];
  var setLoading = _l[1];

  useEffect(function () {
    var unsub = onAuthStateChanged(auth, function (firebaseUser) {
      if (firebaseUser) {
        // ดึงข้อมูลเพิ่มเติมจาก Firestore
        getDoc(doc(db, "users", firebaseUser.uid)).then(function (snap) {
          if (snap.exists()) {
            var data = snap.data();
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              name: data.name || firebaseUser.email.split("@")[0],
              role: data.role || "user",
              dept: data.dept || "",
            });
          } else {
            // ถ้ายังไม่มี profile ใน Firestore ให้สร้าง default
            var isAdmin = firebaseUser.email === "admin@up.ac.th";
            var defaultData = {
              email: firebaseUser.email,
              name: isAdmin ? "ผู้ดูแลระบบ" : firebaseUser.email.split("@")[0],
              role: isAdmin ? "admin" : "user",
              dept: isAdmin ? "IT" : "",
              createdAt: new Date().toISOString(),
            };
            setDoc(doc(db, "users", firebaseUser.uid), defaultData);
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              name: defaultData.name,
              role: defaultData.role,
              dept: defaultData.dept,
            });
          }
          setLoading(false);
        });
      } else {
        setUser(null);
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  function register(email, password) {
    return createUserWithEmailAndPassword(auth, email, password);
  }

  function logout() {
    return signOut(auth);
  }

  return { user: user, loading: loading, login: login, register: register, logout: logout };
}
