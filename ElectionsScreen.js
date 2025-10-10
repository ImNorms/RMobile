import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { db } from "./firebaseConfig";
import {
  collection,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { useNavigation } from "@react-navigation/native";

export default function ElectionsScreen() {
  const [elections, setElections] = useState({});
  const [eventInfo, setEventInfo] = useState(null);
  const [eventId, setEventId] = useState(null);
  const [selectedChoices, setSelectedChoices] = useState({});
  const [loading, setLoading] = useState(true);
  const [missingPositions, setMissingPositions] = useState([]);
  const [isActive, setIsActive] = useState(true);
  const [timeMessage, setTimeMessage] = useState("");

  const auth = getAuth();
  const navigation = useNavigation();

  const scrollViewRef = useRef(null);
  const sectionPositions = useRef({});

  // 🔹 Helper to parse string date + time into Date object
  const parseDateTime = (dateStr, timeStr) => {
    try {
      return new Date(`${dateStr}T${timeStr}:00`);
    } catch {
      return null;
    }
  };

  // 🔹 Check election status + update countdown
  const updateElectionStatus = (start, end, dateStr) => {
    let startDate, endDate;

    if (start?.seconds) {
      startDate = new Date(start.seconds * 1000);
    } else if (typeof start === "string" && dateStr) {
      startDate = parseDateTime(dateStr, start);
    }

    if (end?.seconds) {
      endDate = new Date(end.seconds * 1000);
    } else if (typeof end === "string" && dateStr) {
      endDate = parseDateTime(dateStr, end);
    }

    if (!startDate || !endDate) return;

    const now = new Date();

    if (now < startDate) {
      setIsActive(false);
      setTimeMessage(`Voting will start at ${startDate.toLocaleTimeString()}`);
    } else if (now >= startDate && now <= endDate) {
      setIsActive(true);
      const diff = endDate - now;
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeMessage(`🕒 Voting ends in ${hours}h ${minutes}m ${seconds}s`);
    } else {
      setIsActive(false);
      setTimeMessage("⚠️ Voting has ended");
    }
  };

  // Fetch elections and candidates
  useEffect(() => {
    const unsubscribeElections = onSnapshot(collection(db, "elections"), (snap) => {
      let grouped = {};
      let firstEventId = null;
      let eventFields = null;

      snap.forEach((docSnap) => {
        if (!firstEventId) firstEventId = docSnap.id;

        const data = docSnap.data();

        eventFields = {
          title: data.title,
          date: data.date,
          startTime: data.startTime,
          endTime: data.endTime,
          createdAt: data.createdAt,
        };

        // 🔹 Update status immediately
        updateElectionStatus(data.startTime, data.endTime, data.date);

        const candidatesRef = collection(db, "elections", docSnap.id, "candidates");
        onSnapshot(candidatesRef, (candidatesSnap) => {
          let updatedGrouped = { ...grouped };

          candidatesSnap.forEach((candidateDoc) => {
            const candidateData = candidateDoc.data();
            if (!updatedGrouped[candidateData.position]) {
              updatedGrouped[candidateData.position] = [];
            }

            updatedGrouped[candidateData.position] =
              updatedGrouped[candidateData.position].filter((c) => c.id !== candidateDoc.id);

            updatedGrouped[candidateData.position].push({
              ...candidateData,
              id: candidateDoc.id,
            });
          });

          setElections(updatedGrouped);
        });
      });

      setEventInfo(eventFields);
      setEventId(firstEventId);
      setLoading(false);
    });

    return () => unsubscribeElections();
  }, []);

  // 🔹 Keep checking time every second
  useEffect(() => {
    let interval;
    if (eventInfo?.startTime && eventInfo?.endTime && eventInfo?.date) {
      updateElectionStatus(eventInfo.startTime, eventInfo.endTime, eventInfo.date);

      interval = setInterval(() => {
        updateElectionStatus(eventInfo.startTime, eventInfo.endTime, eventInfo.date);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [eventInfo]);

  // Submit votes
  const handleSubmitAllVotes = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        alert("You must be logged in to vote.");
        return;
      }

      if (!eventId) {
        alert("Election event not found.");
        return;
      }

      // 🔹 Block if voting not active
      if (!isActive) {
        alert("⚠️ Voting is not active right now.");
        return;
      }

      const allPositions = Object.keys(elections);
      const selectedPositions = Object.keys(selectedChoices);

      const missing = allPositions.filter((pos) => !selectedPositions.includes(pos));

      if (missing.length > 0) {
        setMissingPositions(missing);

        const firstMissing = missing[0];
        const y = sectionPositions.current[firstMissing];
        if (y !== undefined && scrollViewRef.current) {
          scrollViewRef.current.scrollTo({ y, animated: true });
        }

        alert(
          `⚠️ You did not vote for the following position(s):\n- ${missing.join("\n- ")}`
        );
        return;
      }

      setMissingPositions([]);

      const voteDocId = `${eventId}_${user.uid}`;
      const voteRef = doc(db, "votes", voteDocId);
      const existingVote = await getDoc(voteRef);
      if (existingVote.exists()) {
        alert("⚠️ You have already submitted your vote.");
        return;
      }

      const votesByCandidate = {};
      Object.keys(selectedChoices).forEach((position) => {
        const candidateId = selectedChoices[position];
        if (candidateId) {
          votesByCandidate[position] = { candidateId, votedAt: serverTimestamp() };
        }
      });

      await setDoc(voteRef, {
        userId: user.uid,
        eventId: eventId,
        votes: votesByCandidate,
      });

      alert("✅ Your votes have been submitted!");
      navigation.navigate("ElectionStatus", {
        eventId: eventId,
        votes: votesByCandidate,
      });
    } catch (error) {
      console.error("Error submitting votes:", error);
      alert("Error submitting votes.");
    }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#00695C" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView ref={scrollViewRef}>
        {eventInfo && (
          <View style={styles.eventCard}>
            <Text style={styles.eventTitle}>{eventInfo.title}</Text>
            {eventInfo.date && (
              <Text style={styles.eventDetail}>📅 Date: {eventInfo.date}</Text>
            )}
            {eventInfo.startTime && eventInfo.endTime && (
              <Text style={styles.eventDetail}>
                🕒 Time: {eventInfo.startTime} - {eventInfo.endTime}
              </Text>
            )}
            <Text style={{ marginTop: 5, fontWeight: "bold", color: isActive ? "green" : "red" }}>
              {timeMessage}
            </Text>
          </View>
        )}

        {Object.keys(elections).map((position) => (
          <View
            key={position}
            style={styles.section}
            onLayout={(e) => {
              sectionPositions.current[position] = e.nativeEvent.layout.y;
            }}
          >
            <Text
              style={[
                styles.sectionTitle,
                missingPositions.includes(position) && { color: "red" },
              ]}
            >
              {position}
            </Text>

            <FlatList
              data={elections[position]}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              renderItem={({ item }) => {
                const isSelected = selectedChoices[position] === item.id;

                return (
                  <TouchableOpacity
                    style={[
                      styles.card,
                      isSelected && { borderColor: "#2980b9", borderWidth: 2 },
                    ]}
                    onPress={() =>
                      setSelectedChoices((prev) => {
                        if (prev[position] === item.id) {
                          const updated = { ...prev };
                          delete updated[position];
                          return updated;
                        }
                        return { ...prev, [position]: item.id };
                      })
                    }
                    disabled={!isActive}
                  >
                    {item.photoURL ? (
                      <Image source={{ uri: item.photoURL }} style={styles.image} />
                    ) : (
                      <View style={styles.placeholderImage}>
                        <Text style={styles.initial}>{item.name?.charAt(0)}</Text>
                      </View>
                    )}

                    <View style={styles.info}>
                      <Text style={styles.name}>{item.name}</Text>
                      <Text style={styles.term}>Position: {item.position}</Text>
                      {item.termDuration && (
                        <Text style={styles.term}>Term: {item.termDuration}</Text>
                      )}
                    </View>

                    <Text style={styles.radio}>{isSelected ? "🔘" : "⚪"}</Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        ))}

        <TouchableOpacity
          style={[
            styles.submitButton,
            !isActive && { backgroundColor: "#999" },
          ]}
          onPress={handleSubmitAllVotes}
          disabled={!isActive}
        >
          <Text style={styles.submitText}>
            {isActive ? "Submit All Votes" : "Voting Closed"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f4f4f4", padding: 10 },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },

  eventCard: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    elevation: 3,
  },
  eventTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 5 },
  eventDetail: { fontSize: 14, color: "#555", marginBottom: 3 },

  section: { marginBottom: 25 },
  sectionTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 10 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    marginBottom: 10,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    elevation: 2,
  },
  image: { width: 60, height: 60, borderRadius: 30 },
  placeholderImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#ccc",
    justifyContent: "center",
    alignItems: "center",
  },
  initial: { fontSize: 20, fontWeight: "bold", color: "#fff" },
  info: { flex: 1, marginLeft: 15 },
  name: { fontSize: 16, fontWeight: "bold" },
  term: { fontSize: 12, color: "#777" },
  radio: { fontSize: 20, marginLeft: 10 },
  submitButton: {
    backgroundColor: "#2C3E50",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 20,
    marginBottom: 30,
  },
  submitText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
});
