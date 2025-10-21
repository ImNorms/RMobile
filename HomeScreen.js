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
  StatusBar,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getAuth, signOut } from "firebase/auth";
import {
  getFirestore,
  collection,
  query,
  orderBy,
  getDocs,
  where,
  doc,
  getDoc,
} from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";

const auth = getAuth();
const db = getFirestore();
const { width } = Dimensions.get("window");
const cardWidth = (width - 48) / 2;

export default function HomeScreen({ navigation, route }) {
  const [hasAnnouncement, setHasAnnouncement] = useState(false);
  const [hasEvent, setHasEvent] = useState(false);
  const [hasComplaint, setHasComplaint] = useState(false);
  const [hasAccounting, setHasAccounting] = useState(false);
  const [userName, setUserName] = useState("");
  const [notificationCount, setNotificationCount] = useState(0);
  const [newPostsCount, setNewPostsCount] = useState(0);
  const [newEventsCount, setNewEventsCount] = useState(0);
  const [newComplaintsCount, setNewComplaintsCount] = useState(0);
  const [newAccountingCount, setNewAccountingCount] = useState(0);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const fadeAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setIsAuthenticated(true);
        setUserName(user.displayName || "User");
      } else {
        setIsAuthenticated(false);
        setUserName("");
        // Clear all notifications when user logs out
        setHasAnnouncement(false);
        setHasEvent(false);
        setHasComplaint(false);
        setHasAccounting(false);
        setNewPostsCount(0);
        setNewEventsCount(0);
        setNewComplaintsCount(0);
        setNewAccountingCount(0);
        setNotificationCount(0);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (route?.params?.hasNewAnnouncement !== undefined) {
      setHasAnnouncement(route.params.hasNewAnnouncement);
    }
  }, [route?.params?.hasNewAnnouncement]);

  // Announcement notifications - USING POLLING
  useEffect(() => {
    if (!isAuthenticated || !auth.currentUser) {
      setNewPostsCount(0);
      setHasAnnouncement(false);
      return;
    }

    const checkNewAnnouncements = async () => {
      try {
        const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        
        if (!auth.currentUser || snapshot.empty) {
          setNewPostsCount(0);
          setHasAnnouncement(false);
          return;
        }
        
        const lastSeenSeconds =
          Number(
            await AsyncStorage.getItem(
              `lastSeenAnnouncement_${auth.currentUser.uid}`
            )
          ) || 0;
        let count = 0;
        snapshot.docs.forEach((doc) => {
          const createdAtSeconds = doc.data()?.createdAt?.seconds || 0;
          if (createdAtSeconds > lastSeenSeconds) count++;
        });
        setNewPostsCount(count);
        setHasAnnouncement(count > 0);
      } catch (error) {
        console.log("Announcements check error:", error.message);
        setNewPostsCount(0);
        setHasAnnouncement(false);
      }
    };

    // Use polling instead of real-time listener
    checkNewAnnouncements(); // Initial check
    const interval = setInterval(checkNewAnnouncements, 60000); // Check every minute
    
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // Event notifications - USING POLLING
  useEffect(() => {
    if (!isAuthenticated || !auth.currentUser) {
      setNewEventsCount(0);
      setHasEvent(false);
      return;
    }

    const checkNewEvents = async () => {
      try {
        const q = query(collection(db, "events"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        
        if (!auth.currentUser || snapshot.empty) {
          setNewEventsCount(0);
          setHasEvent(false);
          return;
        }

        const lastSeenTimestamp = Number(
          await AsyncStorage.getItem(`lastSeenEvent_${auth.currentUser.uid}`)
        ) || 0;

        let count = 0;
        
        snapshot.docs.forEach((doc) => {
          const eventData = doc.data();
          let eventTimestamp = 0;
          
          if (eventData.createdAt && typeof eventData.createdAt.toDate === 'function') {
            eventTimestamp = eventData.createdAt.toDate().getTime();
          } else if (eventData.start && typeof eventData.start.toDate === 'function') {
            eventTimestamp = eventData.start.toDate().getTime();
          } else if (eventData.start?.seconds) {
            eventTimestamp = eventData.start.seconds * 1000;
          } else {
            eventTimestamp = Date.now();
          }

          if (eventTimestamp > lastSeenTimestamp) count++;
        });

        setNewEventsCount(count);
        setHasEvent(count > 0);
        
      } catch (error) {
        console.log("Events check error:", error.message);
        setNewEventsCount(0);
        setHasEvent(false);
      }
    };

    // Use polling instead of real-time listener
    checkNewEvents(); // Initial check
    const interval = setInterval(checkNewEvents, 60000); // Check every minute
    
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // Complaint notifications - USING POLLING
  useEffect(() => {
    if (!isAuthenticated || !auth.currentUser) {
      setNewComplaintsCount(0);
      setHasComplaint(false);
      return;
    }

    const checkNewComplaints = async () => {
      try {
        const userId = auth.currentUser.uid;

        // Get status tracking data
        const trackingData = await AsyncStorage.getItem(`complaintStatusTracking_${userId}`);
        const statusTracking = trackingData ? JSON.parse(trackingData) : {};

        // SIMPLIFIED QUERY - Remove complex where clauses
        const q = query(
          collection(db, "complaints"),
          where("userId", "==", userId) // Only filter by user
        );
        
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
          setNewComplaintsCount(0);
          setHasComplaint(false);
          return;
        }

        let newCount = 0;
        
        snapshot.docs.forEach((doc) => {
          const complaintData = doc.data();
          const complaintId = doc.id;
          const currentStatus = complaintData.status;
          const lastKnownStatus = statusTracking[complaintId];

          // Filter status client-side instead of in query
          if (["pending", "rejected", "solved"].includes(currentStatus)) {
            if (!lastKnownStatus || lastKnownStatus !== currentStatus) {
              newCount++;
            }
          }
        });

        setNewComplaintsCount(newCount);
        setHasComplaint(newCount > 0);
        
      } catch (error) {
        console.log("Complaints check error:", error.message);
        setNewComplaintsCount(0);
        setHasComplaint(false);
      }
    };

    // Use polling instead of real-time listener
    checkNewComplaints(); // Initial check
    const interval = setInterval(checkNewComplaints, 60000); // Check every minute
    
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // Accounting notifications - USING POLLING
  useEffect(() => {
    if (!isAuthenticated || !auth.currentUser) {
      setNewAccountingCount(0);
      setHasAccounting(false);
      return;
    }

    const checkNewAccounting = async () => {
      try {
        // Get user's account number
        const user = auth.currentUser;
        const memberRef = doc(db, "members", user.uid);
        const memberSnap = await getDoc(memberRef);

        if (!memberSnap.exists()) {
          setNewAccountingCount(0);
          setHasAccounting(false);
          return;
        }

        const userAccount = memberSnap.data().accNo;
        
        if (!userAccount) {
          setNewAccountingCount(0);
          setHasAccounting(false);
          return;
        }

        // Use query with account number filter
        const q = query(
          collection(db, "contributions"),
          where("accNo", "==", userAccount)
        );
        
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
          setNewAccountingCount(0);
          setHasAccounting(false);
          return;
        }

        // Get seen IDs
        const seenData = await AsyncStorage.getItem(`seenAccountingIds_${user.uid}`);
        const seenIds = seenData ? JSON.parse(seenData) : [];

        // Count unseen contributions
        let newCount = 0;
        snapshot.docs.forEach(doc => {
          if (!seenIds.includes(doc.id)) {
            newCount++;
          }
        });

        setNewAccountingCount(newCount);
        setHasAccounting(newCount > 0);

      } catch (error) {
        console.log("Accounting check error:", error.message);
        setNewAccountingCount(0);
        setHasAccounting(false);
      }
    };

    // Use polling instead of real-time listener
    checkNewAccounting(); // Initial check
    const interval = setInterval(checkNewAccounting, 60000); // Check every minute
    
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // Calculate total notification count
  useEffect(() => {
    let count = 0;
    if (hasAnnouncement) count++;
    if (hasEvent) count++;
    if (hasComplaint) count++;
    if (hasAccounting) count++;
    setNotificationCount(count);
  }, [hasAnnouncement, hasEvent, hasComplaint, hasAccounting]);

  const handleOpenAnnouncement = async () => {
    if (!auth.currentUser) {
      Alert.alert("Authentication Required", "Please log in to view announcements");
      return;
    }
    
    try {
      const currentTime = Date.now();
      await AsyncStorage.setItem(
        `lastSeenAnnouncement_${auth.currentUser.uid}`,
        String(currentTime)
      );
      setNewPostsCount(0);
      setHasAnnouncement(false);
      navigation.navigate("Announcement");
    } catch (error) {
      // Silent error handling
    }
  };

  const handleOpenEvents = async () => {
    if (!auth.currentUser) {
      Alert.alert("Authentication Required", "Please log in to view events");
      return;
    }

    try {
      const currentTime = Date.now();
      const userId = auth.currentUser.uid;
      
      await AsyncStorage.setItem(
        `lastSeenEvent_${userId}`,
        String(currentTime)
      );
      
      setNewEventsCount(0);
      setHasEvent(false);
      navigation.navigate("EventCalendar");
    } catch (error) {
      // Silent error handling
    }
  };

  const handleOpenComplaints = async () => {
    if (!auth.currentUser) {
      Alert.alert("Authentication Required", "Please log in to view complaints");
      return;
    }

    try {
      const userId = auth.currentUser.uid;

      // Get all user complaints and track their CURRENT status
      const q = query(
        collection(db, "complaints"),
        where("userId", "==", userId) // Simplified query
      );
      
      const snapshot = await getDocs(q);
      
      // Create status tracking object with CURRENT status
      const statusTracking = {};
      snapshot.docs.forEach(doc => {
        statusTracking[doc.id] = doc.data().status;
      });
      
      // Save current status tracking
      await AsyncStorage.setItem(
        `complaintStatusTracking_${userId}`,
        JSON.stringify(statusTracking)
      );

      setNewComplaintsCount(0);
      setHasComplaint(false);
      navigation.navigate("Complaints");
      
    } catch (error) {
      navigation.navigate("Complaints");
    }
  };

  const handleOpenAccounting = async () => {
    if (!auth.currentUser) {
      Alert.alert("Authentication Required", "Please log in to view accounting");
      return;
    }

    try {
      const user = auth.currentUser;
      const memberRef = doc(db, "members", user.uid);
      const memberSnap = await getDoc(memberRef);

      if (memberSnap.exists() && memberSnap.data().accNo) {
        const userAccount = memberSnap.data().accNo;
        
        // Use filtered query
        const q = query(
          collection(db, "contributions"),
          where("accNo", "==", userAccount)
        );
        const snapshot = await getDocs(q);
        
        // Get user's contribution IDs
        const userContributionIds = snapshot.docs.map(doc => doc.id);

        // Save all user contribution IDs as seen
        await AsyncStorage.setItem(
          `seenAccountingIds_${user.uid}`,
          JSON.stringify(userContributionIds)
        );
      }

      setNewAccountingCount(0);
      setHasAccounting(false);
      navigation.navigate("Accounting");
      
    } catch (error) {
      // Silent error handling - still navigate
      setNewAccountingCount(0);
      setHasAccounting(false);
      navigation.navigate("Accounting");
    }
  };

  const handleLogout = async () => {
    try {
      // Clear all state first
      setHasAnnouncement(false);
      setHasEvent(false);
      setHasComplaint(false);
      setHasAccounting(false);
      setNewPostsCount(0);
      setNewEventsCount(0);
      setNewComplaintsCount(0);
      setNewAccountingCount(0);
      setNotificationCount(0);
      setUserName("");
      
      // Sign out from Firebase
      await signOut(auth);
      
      // Clear AsyncStorage
      const userId = auth.currentUser?.uid;
      if (userId) {
        await AsyncStorage.removeItem(`lastSeenAnnouncement_${userId}`);
        await AsyncStorage.removeItem(`lastSeenEvent_${userId}`);
        await AsyncStorage.removeItem(`lastSeenComplaint_${userId}`);
        await AsyncStorage.removeItem(`seenComplaintIds_${userId}`);
        await AsyncStorage.removeItem(`complaintStatusTracking_${userId}`);
        await AsyncStorage.removeItem(`seenAccountingIds_${userId}`);
      }
      
      Alert.alert("Logged out", "You have been logged out successfully.");
      navigation.replace("Login");
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  // Show login prompt if not authenticated
  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#00695C" />
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.greeting}>Welcome to</Text>
              <Text style={styles.userName}>HOA Community</Text>
            </View>
          </View>
          <View style={styles.headerDecoration} />
        </View>
        
        <View style={styles.centerContent}>
          <Ionicons name="log-in-outline" size={64} color="#ccc" />
          <Text style={styles.emptyMessage}>Please log in to continue</Text>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => navigation.navigate("Login")}
          >
            <Text style={styles.loginButtonText}>Go to Login</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.footerButton}
            onPress={() => navigation.navigate("Login")}
          >
            <Ionicons name="log-in" size={22} color="#fff" />
            <Text style={styles.footerText}>Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#00695C" />

      <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.userName}>{userName}</Text>
          </View>
          <View style={styles.headerRight}>
            {notificationCount > 0 && (
              <View style={styles.notificationBubble}>
                <Text style={styles.notificationBubbleText}>{notificationCount}</Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.profileButton}
              onPress={() => navigation.navigate("Profile")}
            >
              <Ionicons name="person-circle" size={32} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.headerDecoration} />
      </Animated.View>

      {notificationCount > 0 && (
        <View style={styles.notificationBar}>
          <Ionicons name="notifications" size={20} color="#fff" />
          <Text style={styles.notificationBarText}>
            You have {notificationCount} new notification
            {notificationCount > 1 ? "s" : ""}
          </Text>
          <View style={styles.notificationDetails}>
            {newPostsCount > 0 && (
              <Text style={styles.notificationDetailText}>
                {newPostsCount} new post{newPostsCount > 1 ? "s" : ""}
              </Text>
            )}
            {newEventsCount > 0 && (
              <Text style={styles.notificationDetailText}>
                {newEventsCount} new event{newEventsCount > 1 ? "s" : ""}
              </Text>
            )}
            {newComplaintsCount > 0 && (
              <Text style={styles.notificationDetailText}>
                {newComplaintsCount} complaint update
                {newComplaintsCount > 1 ? "s" : ""}
              </Text>
            )}
            {newAccountingCount > 0 && (
              <Text style={styles.notificationDetailText}>
                {newAccountingCount} new contribution
                {newAccountingCount > 1 ? "s" : ""}
              </Text>
            )}
          </View>
          <TouchableOpacity
            style={styles.notificationClose}
            onPress={() => {
              setHasAnnouncement(false);
              setHasEvent(false);
              setHasComplaint(false);
              setHasAccounting(false);
              setNewPostsCount(0);
              setNewEventsCount(0);
              setNewComplaintsCount(0);
              setNewAccountingCount(0);
            }}
          >
            <Ionicons name="close" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.section, { opacity: fadeAnim }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Latest Announcement</Text>
            {hasAnnouncement && (
              <View style={styles.notificationBadge}>
                <Text style={styles.badgeText}>
                  {newPostsCount > 1 ? `${newPostsCount} New` : "New"}
                </Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={styles.announcementCard}
            onPress={handleOpenAnnouncement}
            activeOpacity={0.9}
          >
            <Image
              source={require("./assets/announcement.png")}
              style={styles.banner}
              resizeMode="cover"
            />
            <View style={styles.overlay}>
              <Text style={styles.announcementText}>
                {hasAnnouncement
                  ? newPostsCount > 1
                    ? `${newPostsCount} new announcements posted!`
                    : "New announcement posted!"
                  : "See what's new in the community"}
              </Text>
              <View style={styles.viewButton}>
                <Text style={styles.viewText}>View Announcements</Text>
                <Ionicons name="arrow-forward" size={16} color="#fff" />
              </View>
            </View>
          </TouchableOpacity>
        </Animated.View>

        <View style={styles.gridSection}>
          <Text style={styles.gridTitle}>Quick Actions</Text>
          <View style={styles.grid}>
            <View style={styles.row}>
              <TouchableOpacity
                style={[styles.card, styles.membersCard]}
                onPress={() => navigation.navigate("Members")}
              >
                <View style={styles.cardIcon}>
                  <Ionicons name="people" size={24} color="#fff" />
                </View>
                <Text style={styles.cardText}>Members</Text>
                <Text style={styles.cardSubtext}>Community directory</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.card, styles.eventsCard]}
                onPress={handleOpenEvents}
              >
                <View style={styles.cardIcon}>
                  <Ionicons name="calendar" size={24} color="#fff" />
                  {hasEvent && (
                    <View style={styles.redDot}>
                      <Text style={styles.redDotText}>
                        {newEventsCount > 9 ? "9+" : newEventsCount}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.cardText}>Events</Text>
                <Text style={styles.cardSubtext}>
                  {hasEvent
                    ? newEventsCount > 1
                      ? `${newEventsCount} new events!`
                      : "New event!"
                    : "Upcoming activities"}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.row}>
              <TouchableOpacity
                style={[styles.card, styles.accountingCard]}
                onPress={handleOpenAccounting}
              >
                <View style={styles.cardIcon}>
                  <Ionicons name="wallet" size={24} color="#fff" />
                  {hasAccounting && (
                    <View style={styles.redDot}>
                      <Text style={styles.redDotText}>
                        {newAccountingCount > 9 ? "9+" : newAccountingCount}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.cardText}>Accounting</Text>
                <Text style={styles.cardSubtext}>
                  {hasAccounting
                    ? newAccountingCount > 1
                      ? `${newAccountingCount} new contributions!`
                      : "New contribution!"
                    : "Financial status"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.card, styles.complaintsCard]}
                onPress={handleOpenComplaints}
              >
                <View style={styles.cardIcon}>
                  <Ionicons name="warning" size={24} color="#fff" />
                  {hasComplaint && (
                    <View style={styles.redDot}>
                      <Text style={styles.redDotText}>
                        {newComplaintsCount > 9 ? "9+" : newComplaintsCount}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.cardText}>Complaints</Text>
                <Text style={styles.cardSubtext}>
                  {hasComplaint
                    ? newComplaintsCount > 1
                      ? `${newComplaintsCount} updates!`
                      : "Status updated!"
                    : "Report issues"}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.row}>
              <TouchableOpacity
                style={[styles.card, styles.officialsCard]}
                onPress={() => navigation.navigate("Committee")}
              >
                <View style={styles.cardIcon}>
                  <Ionicons name="people-circle" size={24} color="#fff" />
                </View>
                <Text style={styles.cardText}>HOA Officials</Text>
                <Text style={styles.cardSubtext}>Board members</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.card, styles.votingCard]}
                onPress={() => navigation.navigate("Voting")}
              >
                <View style={styles.cardIcon}>
                  <Ionicons name="checkmark-circle" size={24} color="#fff" />
                </View>
                <Text style={styles.cardText}>Voting</Text>
                <Text style={styles.cardSubtext}>Cast your vote</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.footerButton}
          onPress={() => navigation.navigate("Profile")}
        >
          <Ionicons name="person-circle" size={22} color="#fff" />
          <Text style={styles.footerText}>Account</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.footerButton}
          onPress={() => navigation.navigate("Home")}
        >
          <Ionicons name="home" size={22} color="#fff" />
          <Text style={styles.footerText}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.footerButton} onPress={handleLogout}>
          <Ionicons name="log-out" size={22} color="#fff" />
          <Text style={styles.footerText}>Log out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#f8f9fa" 
  },
  header: {
    backgroundColor: "#00695C",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  notificationBubble: {
    backgroundColor: "#EF4444",
    borderRadius: 12,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  notificationBubbleText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
    paddingHorizontal: 6,
  },
  headerDecoration: {
    position: "absolute",
    bottom: -10,
    left: 0,
    right: 0,
    height: 20,
    backgroundColor: "#f8f9fa",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  greeting: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.8)",
    fontWeight: "500",
  },
  userName: {
    fontSize: 24,
    color: "#fff",
    fontWeight: "700",
    marginTop: 4,
  },
  profileButton: {
    padding: 8,
  },
  // Center content for logged out state
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyMessage: {
    fontSize: 18,
    color: "#666",
    textAlign: "center",
    marginTop: 16,
    marginBottom: 24,
  },
  loginButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  loginButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  notificationBar: {
    backgroundColor: "#007b83",
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  notificationBarText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  notificationDetails: {
    marginBottom: 8,
  },
  notificationDetailText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 2,
  },
  notificationClose: {
    position: "absolute",
    top: 12,
    right: 12,
    padding: 4,
  },
  scrollContent: { 
    paddingBottom: 100,
    paddingTop: 16,
  },
  section: {
    marginHorizontal: 20,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
    marginRight: 8,
  },
  notificationBadge: {
    backgroundColor: "#EF4444",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
  },
  announcementCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  banner: {
    width: "100%",
    height: width * 0.4,
  },
  overlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0, 105, 92, 0.85)",
    padding: 16,
  },
  announcementText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  viewButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
  },
  viewText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    marginRight: 4,
  },
  gridSection: {
    marginHorizontal: 20,
  },
  gridTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 16,
  },
  grid: {
    marginBottom: 20,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  card: {
    width: cardWidth,
    padding: 16,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    position: "relative",
  },
  cardText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
    marginBottom: 4,
  },
  cardSubtext: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    fontWeight: "500",
  },
  membersCard: {
    backgroundColor: "#007b83",
  },
  eventsCard: {
    backgroundColor: "#008C7A",
  },
  accountingCard: {
    backgroundColor: "#005f99",
  },
  complaintsCard: {
    backgroundColor: "#E74C3C",
  },
  officialsCard: {
    backgroundColor: "#F39C12",
  },
  votingCard: {
    backgroundColor: "#8E44AD",
  },
  redDot: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#EF4444",
    borderWidth: 2,
    borderColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  redDotText: {
    color: "#fff",
    fontSize: 8,
    fontWeight: "bold",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 12,
    backgroundColor: "#004d40",
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  footerButton: {
    alignItems: "center",
  },
  footerText: {
    color: "#fff",
    fontSize: 12,
    marginTop: 3,
    textAlign: "center",
  },
});