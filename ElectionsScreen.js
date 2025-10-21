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

  const POSITION_ORDER = [
    "President",
    "Vice President", 
    "Treasurer",
    "Secretary"
  ];

  const parseDateTime = (dateStr, timeStr) => {
    try {
      return new Date(`${dateStr}T${timeStr}:00`);
    } catch {
      return null;
    }
  };

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
      setTimeMessage(`Voting starts at ${startDate.toLocaleTimeString()}`);
    } else if (now >= startDate && now <= endDate) {
      setIsActive(true);
      const diff = endDate - now;
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeMessage(`Ends in ${hours}h ${minutes}m ${seconds}s`);
    } else {
      setIsActive(false);
      setTimeMessage("Voting has ended");
    }
  };

  const getSortedPositions = (electionsData) => {
    return Object.keys(electionsData).sort((a, b) => {
      const indexA = POSITION_ORDER.indexOf(a);
      const indexB = POSITION_ORDER.indexOf(b);
      
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }
      
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      
      return a.localeCompare(b);
    });
  };

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

      if (!isActive) {
        alert("⚠️ Voting is not active right now.");
        return;
      }

      const sortedPositions = getSortedPositions(elections);
      const selectedPositions = Object.keys(selectedChoices);

      const missing = sortedPositions.filter((pos) => !selectedPositions.includes(pos));

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
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={styles.loadingText}>Loading Election...</Text>
      </View>
    );
  }

  const sortedPositions = getSortedPositions(elections);

  return (
    <View style={styles.container}>
      <ScrollView ref={scrollViewRef} showsVerticalScrollIndicator={false}>
        {eventInfo && (
          <View style={styles.headerContainer}>
            <View style={styles.eventCard}>
              <Text style={styles.eventTitle}>{eventInfo.title}</Text>
              <View style={styles.eventDetailsContainer}>
                {eventInfo.date && (
                  <View style={styles.eventDetailRow}>
                    <Text style={styles.eventIcon}>📅</Text>
                    <Text style={styles.eventDetail}>{eventInfo.date}</Text>
                  </View>
                )}
                {eventInfo.startTime && eventInfo.endTime && (
                  <View style={styles.eventDetailRow}>
                    <Text style={styles.eventIcon}>🕒</Text>
                    <Text style={styles.eventDetail}>
                      {eventInfo.startTime} - {eventInfo.endTime}
                    </Text>
                  </View>
                )}
              </View>
              <View style={[
                styles.statusBadge,
                isActive ? styles.statusActive : styles.statusInactive
              ]}>
                <View style={[
                  styles.statusDot,
                  isActive ? styles.dotActive : styles.dotInactive
                ]} />
                <Text style={styles.statusText}>{timeMessage}</Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.content}>
          {sortedPositions.map((position, index) => (
            <View
              key={position}
              style={styles.section}
              onLayout={(e) => {
                sectionPositions.current[position] = e.nativeEvent.layout.y;
              }}
            >
              <View style={styles.sectionHeader}>
                <View style={styles.positionBadge}>
                  <Text style={styles.positionNumber}>{index + 1}</Text>
                </View>
                <Text
                  style={[
                    styles.sectionTitle,
                    missingPositions.includes(position) && styles.sectionTitleError,
                  ]}
                >
                  {position}
                </Text>
              </View>

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
                        isSelected && styles.cardSelected,
                        !isActive && styles.cardDisabled,
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
                      activeOpacity={0.7}
                    >
                      <View style={styles.cardContent}>
                        {item.photoURL ? (
                          <Image source={{ uri: item.photoURL }} style={styles.image} />
                        ) : (
                          <View style={styles.placeholderImage}>
                            <Text style={styles.initial}>{item.name?.charAt(0)}</Text>
                          </View>
                        )}

                        <View style={styles.info}>
                          <Text style={styles.name}>{item.name}</Text>
                          <Text style={styles.position}>{item.position}</Text>
                          {item.termDuration && (
                            <Text style={styles.term}>Term: {item.termDuration}</Text>
                          )}
                        </View>

                        <View style={[
                          styles.radioContainer,
                          isSelected && styles.radioSelected
                        ]}>
                          {isSelected && <View style={styles.radioInner} />}
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            </View>
          ))}

          <TouchableOpacity
            style={[
              styles.submitButton,
              !isActive && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmitAllVotes}
            disabled={!isActive}
            activeOpacity={0.8}
          >
            <Text style={styles.submitText}>
              {isActive ? "Submit All Votes" : "Voting Closed"}
            </Text>
            {isActive && <Text style={styles.submitIcon}>→</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#F8FAFC",
  },
  loader: { 
    flex: 1, 
    justifyContent: "center", 
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#64748B",
    fontWeight: "500",
  },

  headerContainer: {
    backgroundColor: "#004d40",
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  eventCard: {
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  eventTitle: { 
    fontSize: 24, 
    fontWeight: "700", 
    marginBottom: 16,
    color: "#1E293B",
  },
  eventDetailsContainer: {
    marginBottom: 16,
  },
  eventDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  eventIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  eventDetail: { 
    fontSize: 15, 
    color: "#64748B",
    fontWeight: "500",
  },

  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  statusActive: {
    backgroundColor: "#DCFCE7",
  },
  statusInactive: {
    backgroundColor: "#FEE2E2",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  dotActive: {
    backgroundColor: "#16A34A",
  },
  dotInactive: {
    backgroundColor: "#DC2626",
  },
  statusText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E293B",
  },

  content: {
    padding: 20,
  },
  section: { 
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  positionBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#4F46E5",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  positionNumber: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  sectionTitle: { 
    fontSize: 20, 
    fontWeight: "700",
    color: "#1E293B",
  },
  sectionTitleError: {
    color: "#DC2626",
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    marginBottom: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardSelected: {
    borderColor: "#4F46E5",
    backgroundColor: "#EEF2FF",
  },
  cardDisabled: {
    opacity: 0.6,
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
  },

  image: { 
    width: 64, 
    height: 64, 
    borderRadius: 32,
    borderWidth: 2,
    borderColor: "#E2E8F0",
  },
  placeholderImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#CBD5E1",
    justifyContent: "center",
    alignItems: "center",
  },
  initial: { 
    fontSize: 24, 
    fontWeight: "700", 
    color: "#FFFFFF",
  },

  info: { 
    flex: 1, 
    marginLeft: 16,
  },
  name: { 
    fontSize: 17, 
    fontWeight: "600",
    color: "#1E293B",
    marginBottom: 4,
  },
  position: {
    fontSize: 14,
    color: "#64748B",
    fontWeight: "500",
    marginBottom: 2,
  },
  term: { 
    fontSize: 13, 
    color: "#94A3B8",
  },

  radioContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 12,
  },
  radioSelected: {
    borderColor: "#4F46E5",
    backgroundColor: "#4F46E5",
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#FFFFFF",
  },

  submitButton: {
    backgroundColor: "#4F46E5",
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 12,
    marginBottom: 30,
    flexDirection: "row",
    justifyContent: "center",
    shadowColor: "#4F46E5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  submitButtonDisabled: {
    backgroundColor: "#94A3B8",
    shadowOpacity: 0,
  },
  submitText: { 
    color: "#FFFFFF", 
    fontWeight: "700", 
    fontSize: 17,
  },
  submitIcon: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
    marginLeft: 8,
  },
});