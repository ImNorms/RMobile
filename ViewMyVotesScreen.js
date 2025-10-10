import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Image } from "react-native";
import { db } from "./firebaseConfig";
import { getAuth } from "firebase/auth";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";

export default function MyVotesScreen({ route }) {
  const { eventId } = route.params || {};
  const [myVotes, setMyVotes] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMyVotes = async () => {
      try {
        const user = getAuth().currentUser;
        if (!user || !eventId) return;

        const voteRef = doc(db, "votes", `${eventId}_${user.uid}`);
        const voteSnap = await getDoc(voteRef);
        setMyVotes(voteSnap.exists() ? voteSnap.data().votes : {});

        const candidatesRef = collection(db, "elections", eventId, "candidates");
        const candidatesSnap = await getDocs(candidatesRef);
        const candidateList = [];
        candidatesSnap.forEach((docSnap) => {
          candidateList.push({ id: docSnap.id, ...docSnap.data() });
        });
        setCandidates(candidateList);
      } catch (error) {
        console.error("Error fetching my votes:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMyVotes();
  }, [eventId]);

  if (loading)
    return (
      <ActivityIndicator
        size="large"
        color="#007bff"
        style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
      />
    );

  if (!myVotes || Object.keys(myVotes).length === 0)
    return <Text style={styles.noVoteText}>You haven't voted yet.</Text>;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>My Votes</Text>
      {Object.entries(myVotes).map(([position, vote]) => {
        const candidate = candidates.find((c) => c.id === vote.candidateId);
        return (
          <View key={position} style={styles.voteCard}>
            <Text style={styles.position}>{position}</Text>

            <View style={styles.candidateContainer}>
              {candidate?.photoURL ? (
                <Image source={{ uri: candidate.photoURL }} style={styles.candidatePhoto} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Text style={styles.photoInitial}>{candidate?.name?.charAt(0) || "?"}</Text>
                </View>
              )}
              <Text style={styles.candidateName}>
                {candidate ? candidate.name : "Unknown Candidate"}
              </Text>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 16 },
  voteCard: {
    backgroundColor: "#f8f9fa",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  position: { fontSize: 18, fontWeight: "600", marginBottom: 8 },
  candidateContainer: { flexDirection: "row", alignItems: "center" },
  candidatePhoto: { width: 50, height: 50, borderRadius: 25, marginRight: 12 },
  photoPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#ccc",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  photoInitial: { fontSize: 20, fontWeight: "bold", color: "#fff" },
  candidateName: { fontSize: 16, fontWeight: "500" },
  noVoteText: { fontSize: 18, color: "gray", textAlign: "center", marginTop: 50 },
});
