import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Dimensions,
  Modal,
  TouchableOpacity,
  Alert,
  useWindowDimensions,
} from "react-native";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db, auth } from "./firebaseConfig";
import { signOut } from "firebase/auth";
import { Calendar } from "react-native-calendars";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const responsiveSize = (size) => {
  const scale = SCREEN_WIDTH / 375;
  return Math.round(size * Math.min(scale, 1.5));
};

export default function EventCalendarScreen({ navigation, route }) {
  const [events, setEvents] = useState([]);
  const [markedDates, setMarkedDates] = useState({});
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDateEvents, setSelectedDateEvents] = useState([]);
  const [selectedDateStr, setSelectedDateStr] = useState("");
  const [hasNewEvent, setHasNewEvent] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split("T")[0]);

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const isSmallScreen = width < 375;
  const isTablet = width > 768;

  // --- Fetch events and check for new event in real time ---
  useEffect(() => {
    if (!auth.currentUser) return;

    const eventsRef = collection(db, "events");
    const q = query(eventsRef, orderBy("start", "desc"));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const data = snapshot.docs
        .map((doc) => {
          const item = { id: doc.id, ...doc.data() };
          if (item.start && item.start.seconds) {
            item.dateObj = new Date(item.start.seconds * 1000);
          } else if (item.start) {
            item.dateObj = new Date(item.start);
          }
          return item;
        })
        .filter((e) => e.dateObj && !isNaN(e.dateObj.getTime()));

      const today = new Date();
      const upcoming = [];
      const past = [];

      data.forEach((event) => {
        if (event.dateObj >= today) {
          upcoming.push(event);
        } else {
          past.push(event);
        }
      });

      upcoming.sort((a, b) => a.dateObj - b.dateObj);
      past.sort((a, b) => b.dateObj - a.dateObj);

      const sortedData = [...upcoming, ...past];
      setEvents(sortedData);

      // --- Marked Dates for Calendar ---
      let marks = {};
      const todayYear = today.getFullYear();
      const todayMonth = today.getMonth() + 1;
      const todayDay = today.getDate();
      const todayStr = `${todayYear}-${todayMonth.toString().padStart(2, "0")}-${todayDay
        .toString()
        .padStart(2, "0")}`;

      sortedData.forEach((event) => {
        const eventYear = event.dateObj.getFullYear();
        const eventMonth = event.dateObj.getMonth() + 1;
        const eventDay = event.dateObj.getDate();
        const dateStr = `${eventYear}-${eventMonth
          .toString()
          .padStart(2, "0")}-${eventDay.toString().padStart(2, "0")}`;

        marks[dateStr] = {
          marked: true,
          dotColor: dateStr === todayStr ? "orange" : "#00695C",
        };
      });
      setMarkedDates(marks);

      // --- Real-time notification detection ---
      if (snapshot.docs.length > 0) {
        const latestDoc = snapshot.docs[0];
        const latestData = latestDoc.data();

        let latestTimestamp = 0;
        if (latestData.start && latestData.start.seconds) {
          latestTimestamp = latestData.start.seconds * 1000;
        } else if (latestData.start) {
          latestTimestamp = new Date(latestData.start).getTime();
        }

        const lastSeenStr = await AsyncStorage.getItem(
          `lastSeenEvent_${auth.currentUser.uid}`
        );
        const lastSeen = lastSeenStr ? Number(lastSeenStr) : 0;

        if (!lastSeen || latestTimestamp > lastSeen) {
          setHasNewEvent(true);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // --- Mark as seen when user opens this screen ---
  useEffect(() => {
    const markAsSeen = async () => {
      if (!auth.currentUser || events.length === 0) return;

      try {
        const latestEvent = events[0];
        let latestTimestamp = 0;

        if (latestEvent.start && latestEvent.start.seconds) {
          latestTimestamp = latestEvent.start.seconds * 1000;
        } else if (latestEvent.start) {
          latestTimestamp = new Date(latestEvent.start).getTime();
        }

        await AsyncStorage.setItem(
          `lastSeenEvent_${auth.currentUser.uid}`,
          String(latestTimestamp)
        );

        setHasNewEvent(false);
      } catch (error) {
        console.error("Error marking events as seen:", error);
      }
    };

    const unsubscribe = navigation.addListener("focus", markAsSeen);
    return unsubscribe;
  }, [navigation, events]);

  // --- Set calendar to next upcoming event ---
  useEffect(() => {
    if (events.length > 0) {
      const today = new Date();
      const upcomingEvents = events.filter((event) => event.dateObj >= today);

      if (upcomingEvents.length > 0) {
        const nextEvent = upcomingEvents[0];
        const y = nextEvent.dateObj.getFullYear();
        const m = nextEvent.dateObj.getMonth() + 1;
        const d = nextEvent.dateObj.getDate();
        const nextEventDate = `${y}-${m.toString().padStart(2, "0")}-${d
          .toString()
          .padStart(2, "0")}`;
        setCurrentDate(nextEventDate);
      }
    }
  }, [events]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigation.replace("Login");
    } catch (error) {
      Alert.alert("Logout failed", error.message);
    }
  };

  const renderEvent = ({ item }) => {
    const eventDate = item.dateObj;
    if (!eventDate) return null;

    const month = eventDate
      .toLocaleString("default", { month: "short" })
      .toUpperCase();
    const day = eventDate.getDate();

    return (
      <View style={[styles.eventCard]}>
        <View style={[styles.dateBox]}>
          <Text style={styles.monthText}>{month}</Text>
          <Text style={styles.dayText}>{day}</Text>
        </View>
        <View style={styles.eventInfo}>
          <Text style={styles.eventTitle}>{item.title}</Text>
          <Text style={styles.eventTime}>
            {eventDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </Text>
        </View>
      </View>
    );
  };

  const onDayPress = (day) => {
    const eventsForDay = events.filter((e) => {
      if (!e.dateObj) return false;

      const eventYear = e.dateObj.getFullYear();
      const eventMonth = e.dateObj.getMonth() + 1;
      const eventDay = e.dateObj.getDate();

      const eventDateStr = `${eventYear}-${eventMonth
        .toString()
        .padStart(2, "0")}-${eventDay.toString().padStart(2, "0")}`;

      return eventDateStr === day.dateString;
    });

    if (eventsForDay.length > 0) {
      setSelectedDateEvents(eventsForDay);
      setSelectedDateStr(day.dateString);
      setModalVisible(true);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Event Calendar</Text>
      </View>

      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        renderItem={renderEvent}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            <View style={styles.calendarContainer}>
              <Calendar
                markedDates={markedDates}
                onDayPress={onDayPress}
                current={currentDate}
                theme={{
                  todayTextColor: "#FF6B35",
                  arrowColor: "#00695C",
                  selectedDayBackgroundColor: "#00695C",
                  selectedDayTextColor: "#ffffff",
                  textMonthFontWeight: "bold",
                  monthTextColor: "#1e293b",
                }}
                style={styles.calendar}
              />
            </View>
            <Text style={styles.upcomingTitle}>Upcoming Events</Text>
          </>
        }
      />

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.footerButton}
          onPress={() => navigation.navigate("Profile")}
        >
          <Ionicons name="person-circle" size={24} color="#fff" />
          <Text style={styles.footerText}>Account</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.footerButton}
          onPress={() => navigation.navigate("Home")}
        >
          <View style={{ position: "relative" }}>
            <Ionicons name="home" size={24} color="#fff" />
            {hasNewEvent && (
              <View
                style={{
                  position: "absolute",
                  backgroundColor: "red",
                  top: -2,
                  right: -2,
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                }}
              />
            )}
          </View>
          <Text style={styles.footerText}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.footerButton} onPress={handleLogout}>
          <Ionicons name="log-out" size={24} color="#fff" />
          <Text style={styles.footerText}>Log out</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Events on {selectedDateStr}</Text>
            {selectedDateEvents.map((event) => (
              <View key={event.id} style={styles.modalEvent}>
                <Text style={styles.modalEventTitle}>{event.title}</Text>
                <Text style={styles.modalEventTime}>
                  {event.dateObj.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
            ))}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    backgroundColor: "#00695C",
    paddingTop: 50,
    paddingBottom: 16,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
  },
  upcomingTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
    color: "#1e293b",
  },
  listContent: { padding: 20, paddingBottom: 100 },
  calendarContainer: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    elevation: 4,
    marginBottom: 20,
  },
  calendar: { borderRadius: 12 },
  eventCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: "#00695C",
  },
  dateBox: {
    width: 60,
    height: 60,
    backgroundColor: "#00695C",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  monthText: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  dayText: { color: "#fff", fontWeight: "bold", fontSize: 20 },
  eventInfo: { flex: 1, justifyContent: "center" },
  eventTitle: { fontSize: 18, fontWeight: "bold", color: "#1e293b" },
  eventTime: { fontSize: 16, color: "#64748b" },
  footer: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 16,
    backgroundColor: "#004d40",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    elevation: 8,
  },
  footerButton: { alignItems: "center", position: "relative" },
  footerText: { color: "#fff", fontSize: 12, marginTop: 4, textAlign: "center" },
  modalBackground: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    backgroundColor: "#fff",
    width: "90%",
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 16, textAlign: "center" },
  modalEvent: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  modalEventTitle: { fontSize: 16, fontWeight: "600", color: "#1e293b" },
  modalEventTime: { fontSize: 14, color: "#64748b" },
  closeButton: {
    backgroundColor: "#00695C",
    padding: 14,
    borderRadius: 12,
    marginTop: 16,
    alignItems: "center",
  },
  closeButtonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
});
