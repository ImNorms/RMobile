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

  // 🔹 Define fixed order for positions (same as other screens)
  const POSITION_ORDER = [
    "President",
    "Vice President", 
    "Treasurer",
    "Secretary"
  ];

  // 🔹 Sort positions based on predefined order
  const getSortedVotes = (votes) => {
    if (!votes) return [];
    
    return Object.entries(votes).sort(([positionA], [positionB]) => {
      const indexA = POSITION_ORDER.indexOf(positionA);
      const indexB = POSITION_ORDER.indexOf(positionB);
      
      // If both positions are in the predefined order, sort by that order
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }
      
      // If only position A is in predefined order, it comes first
      if (indexA !== -1) return -1;
      
      // If only position B is in predefined order, it comes first  
      if (indexB !== -1) return 1;
      
      // If neither position is in predefined order, sort alphabetically
      return positionA.localeCompare(positionB);
    });
  };

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

  const sortedVotes = getSortedVotes(myVotes);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>My Votes</Text>
      {sortedVotes.map(([position, vote]) => {
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
              <View style={styles.candidateInfo}>
                <Text style={styles.candidateName}>
                  {candidate ? candidate.name : "Unknown Candidate"}
                </Text>
                {candidate?.termDuration && (
                  <Text style={styles.termDuration}>Term: {candidate.termDuration}</Text>
                )}
              </View>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { 
    padding: 16,
    backgroundColor: "#f5f7fa",
    flexGrow: 1
  },
  title: { 
    fontSize: 24, 
    fontWeight: "bold", 
    marginBottom: 20, 
    textAlign: "center",
    color: "#1976D2"
  },
  voteCard: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  position: { 
    fontSize: 18, 
    fontWeight: "600", 
    marginBottom: 12,
    color: "#00796B",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    paddingBottom: 8
  },
  candidateContainer: { 
    flexDirection: "row", 
    alignItems: "center" 
  },
  candidatePhoto: { 
    width: 60, 
    height: 60, 
    borderRadius: 30, 
    marginRight: 16,
    backgroundColor: "#f0f0f0"
  },
  photoPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#e0e0e0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  photoInitial: { 
    fontSize: 20, 
    fontWeight: "bold", 
    color: "#666" 
  },
  candidateInfo: {
    flex: 1
  },
  candidateName: { 
    fontSize: 16, 
    fontWeight: "500",
    color: "#333",
    marginBottom: 4
  },
  termDuration: {
    fontSize: 12,
    color: "#666",
    fontStyle: "italic"
  },
  noVoteText: { 
    fontSize: 18, 
    color: "gray", 
    textAlign: "center", 
    marginTop: 50 
  },
});