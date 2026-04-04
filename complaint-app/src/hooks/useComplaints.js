import { useState, useEffect } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

var COLLECTION = "complaints";

export default function useComplaints() {
  var _d = useState([]);
  var complaints = _d[0];
  var setComplaints = _d[1];
  var _l = useState(true);
  var loading = _l[0];
  var setLoading = _l[1];

  useEffect(function () {
    var q = query(collection(db, COLLECTION), orderBy("createdAt", "desc"));
    var unsub = onSnapshot(q, function (snapshot) {
      var list = snapshot.docs.map(function (d) {
        var data = d.data();
        return Object.assign({ _docId: d.id }, data);
      });
      setComplaints(list);
      setLoading(false);
    }, function (err) {
      console.error("Firestore listen error:", err);
      setLoading(false);
    });
    return unsub;
  }, []);

  function addComplaint(data) {
    return addDoc(collection(db, COLLECTION), Object.assign({}, data, {
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));
  }

  function updateComplaint(docId, data) {
    return updateDoc(doc(db, COLLECTION, docId), Object.assign({}, data, {
      updatedAt: serverTimestamp(),
    }));
  }

  function removeComplaint(docId) {
    return deleteDoc(doc(db, COLLECTION, docId));
  }

  return {
    complaints: complaints,
    loading: loading,
    addComplaint: addComplaint,
    updateComplaint: updateComplaint,
    removeComplaint: removeComplaint,
  };
}
