import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from "react-native";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { auth, db } from "./firebaseConfig";

export default function AccountingScreen() {
  const [contributions, setContributions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userAccount, setUserAccount] = useState(null);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    // You need to get the user's account number from somewhere
    // This could be from user profile, another collection, or derived from user data
    const getUserAccountNumber = async () => {
      try {
        // Option 1: If you have a users collection that maps auth UID to accNo
        // const userDoc = await getDoc(doc(db, "users", user.uid));
        // const accNo = userDoc.data()?.accNo;
        
        // Option 2: If accNo is derived from user data (example)
        // const accNo = user.email.substring(0, 4); // or some logic
        
        // Option 3: If you want to test with hardcoded value
        const accNo = "0001"; // Replace with actual logic to get user's accNo
        
        setUserAccount(accNo);
      } catch (error) {
        console.error("Error getting user account:", error);
        setLoading(false);
      }
    };

    getUserAccountNumber();
  }, []);

  useEffect(() => {
    if (!userAccount) return;

    const q = query(
      collection(db, "contributions"), 
      where("accNo", "==", userAccount)
    );
    
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setContributions(data);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching contributions:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userAccount]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  if (contributions.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>No contributions found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>💰 My Contributions</Text>
      <FlatList
        data={contributions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Text style={styles.name}>{item.name || "Unnamed Contribution"}</Text>
            <Text style={styles.amount}>Amount: ₱{item.amount || 0}</Text>
            <Text style={styles.date}>Month: {item.monthYear || "N/A"}</Text>
            <Text style={styles.date}>Payment Method: {item.paymentMethod || "N/A"}</Text>
            <Text style={styles.date}>Recipient: {item.recipient || "N/A"}</Text>
            <Text style={styles.date}>Transaction Date: {item.transactionDate?.toDate?.().toLocaleDateString() || "N/A"}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  title: { fontSize: 22, fontWeight: "bold", textAlign: "center", marginBottom: 16 },
  item: {
    backgroundColor: "#f5f5f5",
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  name: { fontSize: 16, fontWeight: "bold" },
  amount: { fontSize: 14 },
  date: { fontSize: 12, color: "gray" },
  text: { fontSize: 16, color: "gray" },
});