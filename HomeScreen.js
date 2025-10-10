import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getAuth, signOut } from "firebase/auth";
import {
  getFirestore,
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
} from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";

const auth = getAuth();
const db = getFirestore();
const { width } = Dimensions.get("window");
const cardWidth = (width - 36) / 2;

export default function HomeScreen({ navigation, route }) {
  const [hasAnnouncement, setHasAnnouncement] = useState(false);
  const [hasEvent, setHasEvent] = useState(false);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      setUserName(user.displayName || "User");
    }
  }, [auth.currentUser]);

  useEffect(() => {
    if (route?.params?.hasNewAnnouncement !== undefined) {
      setHasAnnouncement(route.params.hasNewAnnouncement);
    }
  }, [route?.params?.hasNewAnnouncement]);

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(
      collection(db, "posts"),
      orderBy("createdAt", "desc"),
      limit(1)
    );
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      if (!auth.currentUser || snapshot.empty) return;
      const latestDoc = snapshot.docs[0];
      const createdAtSeconds = latestDoc.data()?.createdAt?.seconds || 0;
      const lastSeen =
        Number(
          await AsyncStorage.getItem(
            `lastSeenAnnouncement_${auth.currentUser.uid}`
          )
        ) || 0;
      setHasAnnouncement(createdAtSeconds > lastSeen);
    });
    return () => unsubscribe();
  }, [auth.currentUser]);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(collection(db, "events"), orderBy("start", "desc"), limit(1));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      if (!auth.currentUser || snapshot.empty) return;

      const latestDoc = snapshot.docs[0];
      const eventData = latestDoc.data();

      let eventTimestamp = 0;
      if (eventData.start?.seconds) {
        eventTimestamp = eventData.start.seconds * 1000;
      } else if (eventData.start?.toDate) {
        eventTimestamp = eventData.start.toDate().getTime();
      } else {
        eventTimestamp = Date.now();
      }

      const lastSeen =
        Number(
          await AsyncStorage.getItem(`lastSeenEvent_${auth.currentUser.uid}`)
        ) || 0;

      setHasEvent(eventTimestamp > lastSeen);
    });

    return () => unsubscribe();
  }, [auth.currentUser]);

  const handleOpenAnnouncement = async () => {
    if (!auth.currentUser) return;
    const q = query(
      collection(db, "posts"),
      orderBy("createdAt", "desc"),
      limit(1)
    );
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const latestDoc = snapshot.docs[0];
      const createdAtSeconds = latestDoc.data()?.createdAt?.seconds || 0;
      await AsyncStorage.setItem(
        `lastSeenAnnouncement_${auth.currentUser.uid}`,
        String(createdAtSeconds)
      );
      setHasAnnouncement(false);
    }
    navigation.navigate("Announcement");
  };

  const handleOpenEvents = async () => {
    if (!auth.currentUser) return;

    const q = query(collection(db, "events"), orderBy("start", "desc"), limit(1));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const latestDoc = snapshot.docs[0];
      const eventData = latestDoc.data();

      let eventTimestamp = 0;
      if (eventData.start?.seconds) {
        eventTimestamp = eventData.start.seconds * 1000;
      } else if (eventData.start?.toDate) {
        eventTimestamp = eventData.start.toDate().getTime();
      } else {
        eventTimestamp = Date.now();
      }

      await AsyncStorage.setItem(
        `lastSeenEvent_${auth.currentUser.uid}`,
        String(eventTimestamp)
      );
      setHasEvent(false);
    }

    navigation.navigate("EventCalendar");
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      const userId = auth.currentUser?.uid;
      if (userId) {
        await AsyncStorage.removeItem(`lastSeenAnnouncement_${userId}`);
        await AsyncStorage.removeItem(`lastSeenEvent_${userId}`);
      }
      Alert.alert("Logged out", "You have been logged out successfully.");
      navigation.replace("Login");
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerBox}>
          <Text style={styles.header}>Homepage</Text>
          <Text style={styles.greeting}>Hello, {userName}</Text>
        </View>

        <View style={styles.sectionBox}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Post and Announcement</Text>
            {hasAnnouncement && <View style={styles.redDot} />}
          </View>

          <TouchableOpacity onPress={handleOpenAnnouncement}>
            <Image
              source={require("./assets/announcement.png")}
              style={styles.banner}
              resizeMode="cover"
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.viewButton}
            onPress={handleOpenAnnouncement}
          >
            <Text style={styles.viewText}>View all post</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.grid}>
          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.card, { backgroundColor: "#007b83", width: cardWidth }]}
              onPress={() => navigation.navigate("Members")}
            >
              <Ionicons name="people" size={26} color="#fff" />
              <Text style={styles.cardText}>Members</Text>
              <Text style={styles.smallText}>View all</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.card, { backgroundColor: "#008C7A", width: cardWidth }]}
              onPress={handleOpenEvents}
            >
              <View style={{ position: "relative" }}>
                <Ionicons name="calendar" size={26} color="#fff" />
                {hasEvent && <View style={styles.redDotSmall} />}
              </View>
              <Text style={styles.cardText}>Event Calendar</Text>
              <Text style={styles.smallText}>View Events</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.card, { backgroundColor: "#005f99", width: cardWidth }]}
              onPress={() => navigation.navigate("Accounting")}
            >
              <Ionicons name="wallet" size={26} color="#fff" />
              <Text style={styles.cardText}>Accounting</Text>
              <Text style={styles.smallText}>Check Status</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.card, { backgroundColor: "#E74C3C", width: cardWidth }]}
              onPress={() => navigation.navigate("Complaints")}
            >
              <Ionicons name="warning" size={26} color="#fff" />
              <Text style={styles.cardText}>Complaints</Text>
              <Text style={styles.smallText}>+ File a complaint</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.card, { backgroundColor: "#F39C12", width: cardWidth }]}
              onPress={() => navigation.navigate("Committee")}
            >
              <Ionicons name="people-circle" size={26} color="#fff" />
              <Text style={styles.cardText}>HOA Officials</Text>
              <Text style={styles.smallText}>View all</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.card, { backgroundColor: "#8E44AD", width: cardWidth }]}
              onPress={() => navigation.navigate("Voting")}
            >
              <Ionicons name="checkmark-circle" size={26} color="#fff" />
              <Text style={styles.cardText}>Voting</Text>
              <Text style={styles.smallText}>View all</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity onPress={() => navigation.navigate("Profile")}>
          <Ionicons name="person-circle" size={22} color="#fff" />
          <Text style={styles.footerText}>Account</Text>
        </TouchableOpacity>
        <TouchableOpacity>
          <Ionicons name="home" size={22} color="#fff" />
          <Text style={styles.footerText}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleLogout}>
          <Ionicons name="log-out" size={22} color="#fff" />
          <Text style={styles.footerText}>Log out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f4f4f4" },
  scrollContent: { paddingBottom: 110 },
  headerBox: { padding: 15, backgroundColor: "#00695C" },
  header: { fontSize: 20, fontWeight: "bold", color: "#fff" },
  greeting: { fontSize: 14, color: "#fff", marginTop: 2 },
  sectionBox: { backgroundColor: "#fff", margin: 12, borderRadius: 10, padding: 10 },
  sectionHeader: { flexDirection: "row", alignItems: "center" },
  sectionTitle: { fontSize: 16, fontWeight: "bold" },
  banner: { width: "100%", height: width * 0.4, borderRadius: 8, marginTop: 8 },
  viewButton: { alignSelf: "flex-end", marginTop: 6 },
  viewText: { fontSize: 12, color: "#007b83" },
  grid: { marginHorizontal: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  card: { marginHorizontal: 4, padding: 15, borderRadius: 10, alignItems: "center" },
  cardText: { color: "#fff", fontWeight: "bold", fontSize: 14, marginTop: 5, textAlign: "center" },
  smallText: { color: "#fff", fontSize: 11, marginTop: 3 },
  redDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "red",
    marginLeft: 6,
    borderWidth: 2,
    borderColor: "#fff",
  },
  redDotSmall: {
    position: "absolute",
    top: -6,
    right: -8,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "red",
    borderWidth: 2,
    borderColor: "#fff",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 10,
    backgroundColor: "#004d40",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  footerText: { color: "#fff", fontSize: 12, textAlign: "center", marginTop: 3 },
});
