import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Image,
  Dimensions,
  useWindowDimensions,
  TouchableOpacity,
  Alert,
} from "react-native";
import { collection, onSnapshot } from "firebase/firestore";
import { getAuth, signOut } from "firebase/auth";
import { db } from "./firebaseConfig";
import { Ionicons } from "@expo/vector-icons";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const responsiveSize = (size) => {
  const scale = SCREEN_WIDTH / 375;
  return Math.round(size * Math.min(scale, 1.5));
};

export default function MembersScreen({ navigation }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const auth = getAuth();
  const currentUser = auth.currentUser;
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "members"),
      (snapshot) => {
        let data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        data.sort((a, b) => {
          const isAActive = currentUser && a.id === currentUser.uid;
          const isBActive = currentUser && b.id === currentUser.uid;
          return isBActive - isAActive;
        });

        setMembers(data);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching members: ", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigation.reset({
        index: 0,
        routes: [{ name: "Login" }],
      });
    } catch (error) {
      Alert.alert("Logout failed", error.message);
    }
  };

  const getInitials = (name) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getRandomColor = (id) => {
    const colors = [
      "#FF6B6B",
      "#4ECDC4",
      "#45B7D1",
      "#96CEB4",
      "#FFEAA7",
      "#DDA0DD",
      "#98D8C8",
      "#F7DC6F",
      "#BB8FCE",
      "#85C1E9",
    ];
    return colors[(id?.charCodeAt(0) || 0) % colors.length];
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00695C" />
        <Text style={styles.loadingText}>Loading community members...</Text>
      </View>
    );
  }

  const renderMemberCard = ({ item }) => {
    const isActiveUser = currentUser && item.id === currentUser.uid;
    const avatarColor = getRandomColor(item.id);

    return (
      <View
        style={[
          styles.memberCard,
          isActiveUser && styles.activeUserCard,
          isLandscape && styles.landscapeCard,
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={styles.avatarContainer}>
            {item.photoURL ? (
              <Image source={{ uri: item.photoURL }} style={styles.avatar} />
            ) : (
              <View
                style={[
                  styles.avatarPlaceholder,
                  { backgroundColor: avatarColor },
                ]}
              >
                <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
              </View>
            )}
            <View
              style={[
                styles.statusIndicator,
                isActiveUser ? styles.activeIndicator : styles.inactiveIndicator,
              ]}
            />
          </View>

          <View
            style={[styles.memberInfo, isLandscape && styles.landscapeMemberInfo]}
          >
            <View style={styles.nameContainer}>
              <Text style={styles.memberName} numberOfLines={1}>
                {item.name || "Unnamed Member"}
              </Text>
              {isActiveUser && (
                <View style={styles.youBadge}>
                  <Text style={styles.youText}>You</Text>
                </View>
              )}
            </View>
            <Text style={styles.memberEmail} numberOfLines={1}>
              {item.email || "No email"}
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={responsiveSize(20)}
            color="#CBD5E1"
          />
        </View>

        <View style={styles.cardDetails}>
          <View
            style={[styles.detailRow, isLandscape && styles.landscapeDetailRow]}
          >
            <View style={styles.detailItem}>
              <Ionicons
                name="home-outline"
                size={responsiveSize(16)}
                color="#64748B"
              />
              <Text style={styles.detailText} numberOfLines={1}>
                {item.unitNumber || item.unit || "Unit not specified"}
              </Text>
            </View>

            <View style={styles.detailItem}>
              <Ionicons
                name="call-outline"
                size={responsiveSize(16)}
                color="#64748B"
              />
              <Text style={styles.detailText} numberOfLines={1}>
                {item.phone ||
                  item.contactNo ||
                  item.contact ||
                  "Not provided"}
              </Text>
            </View>
          </View>

          <View style={styles.statusContainer}>
            <View
              style={[
                styles.statusBadge,
                isActiveUser ? styles.activeBadge : styles.inactiveBadge,
              ]}
            >
              <Ionicons
                name={isActiveUser ? "checkmark-circle" : "time-outline"}
                size={responsiveSize(14)}
                color={isActiveUser ? "#059669" : "#DC2626"}
              />
              <Text
                style={[
                  styles.statusText,
                  { color: isActiveUser ? "#059669" : "#DC2626" },
                ]}
              >
                {isActiveUser ? "Active Member" : "Inactive"}
              </Text>
            </View>

            <Text style={styles.joinDate} numberOfLines={1}>
              {item.joinDate || item.dateJoined || "Member"}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, isLandscape && styles.landscapeHeader]}>
        <View>
          <Text style={styles.headerTitle}>Community Members</Text>
          <Text style={styles.headerSubtitle}>
            {members.length}{" "}
            {members.length === 1 ? "neighbor" : "neighbors"} in your community
          </Text>
        </View>
        <View style={styles.headerDecoration} />
      </View>

      <FlatList
        data={members}
        keyExtractor={(item) => item.id}
        renderItem={renderMemberCard}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContainer,
          isLandscape && styles.landscapeListContainer,
        ]}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons
              name="people-outline"
              size={responsiveSize(64)}
              color="#CBD5E1"
            />
            <Text style={styles.emptyStateTitle}>No members found</Text>
            <Text style={styles.emptyStateText}>
              There are no members in the community yet
            </Text>
          </View>
        }
      />

      {/* Footer from AnnouncementScreen */}
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
    backgroundColor: "#f8f9fa",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  header: {
    backgroundColor: "#00695C",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    marginBottom: 10,
  },
  landscapeHeader: {
    paddingTop: 40,
    paddingBottom: 15,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "white",
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.8)",
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
  listContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  landscapeListContainer: {
    paddingHorizontal: 30,
  },
  memberCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  activeUserCard: {
    borderColor: "#00695C",
    borderWidth: 2,
    shadowColor: "#00695C",
    shadowOpacity: 0.15,
  },
  landscapeCard: {
    marginBottom: 15,
    padding: 20,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  avatarContainer: {
    position: "relative",
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  statusIndicator: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "white",
  },
  activeIndicator: {
    backgroundColor: "#10B981",
  },
  inactiveIndicator: {
    backgroundColor: "#EF4444",
  },
  memberInfo: {
    flex: 1,
  },
  landscapeMemberInfo: {
    flex: 1.5,
  },
  nameContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  memberName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1e293b",
    marginRight: 8,
  },
  youBadge: {
    backgroundColor: "#00695C",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  youText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  memberEmail: {
    fontSize: 14,
    color: "#64748b",
  },
  cardDetails: {
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 12,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  landscapeDetailRow: {
    marginBottom: 15,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  detailText: {
    marginLeft: 6,
    fontSize: 14,
    color: "#475569",
    flex: 1,
  },
  statusContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
  },
  activeBadge: {
    backgroundColor: "#f0fdf4",
  },
  inactiveBadge: {
    backgroundColor: "#fef2f2",
  },
  statusText: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: "600",
  },
  joinDate: {
    fontSize: 12,
    color: "#94a3b8",
    fontStyle: "italic",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#64748b",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 22,
  },

  // Footer Styles from AnnouncementScreen
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