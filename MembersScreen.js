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

// Status configuration - Removed Deleted status
const STATUS_CONFIG = {
  "Active": {
    label: "Active Member",
    icon: "checkmark-circle",
    color: "#059669",
    bgColor: "#f0fdf4",
    indicatorColor: "#10B981",
    priority: 0
  },
  "New": {
    label: "New Member",
    icon: "person-add",
    color: "#2563EB",
    bgColor: "#eff6ff",
    indicatorColor: "#3B82F6",
    priority: 1
  },
  "Inactive": {
    label: "Inactive Member",
    icon: "time-outline",
    color: "#DC2626",
    bgColor: "#fef2f2",
    indicatorColor: "#EF4444",
    priority: 2
  }
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

        // Filter out deleted members
        data = data.filter(member => member.status !== "Deleted");

        // Sort members: current user first, then by status priority, then by surname
        data.sort((a, b) => {
          // Current user always first
          const isACurrent = currentUser && a.email === currentUser.email;
          const isBCurrent = currentUser && b.email === currentUser.email;
          if (isACurrent && !isBCurrent) return -1;
          if (!isACurrent && isBCurrent) return 1;

          // Status priority based on your database values
          const aStatus = a.status || "Inactive";
          const bStatus = b.status || "Inactive";
          const aPriority = STATUS_CONFIG[aStatus]?.priority ?? 2;
          const bPriority = STATUS_CONFIG[bStatus]?.priority ?? 2;
          
          if (aPriority !== bPriority) return aPriority - bPriority;

          // Then sort by surname (using your database field)
          const aName = a.surname || a.name || "";
          const bName = b.surname || b.name || "";
          return aName.localeCompare(bName);
        });

        setMembers(data);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching members: ", error);
        setLoading(false);
        Alert.alert("Error", "Failed to load members");
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

  const getInitials = (member) => {
    // Use firstname and surname from your database structure
    const firstName = member.firstname || "";
    const surname = member.surname || "";
    
    if (!firstName && !surname) {
      return member.name ? getInitialsFromName(member.name) : "?";
    }
    
    return `${firstName.charAt(0)}${surname.charAt(0)}`.toUpperCase();
  };

  const getInitialsFromName = (name) => {
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
      "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7",
      "#DDA0DD", "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E9",
    ];
    return colors[(id?.charCodeAt(0) || 0) % colors.length];
  };

  const getFullName = (member) => {
    // Construct full name from your database fields
    const firstName = member.firstname || "";
    const middleName = member.middlename ? `${member.middlename.charAt(0)}.` : "";
    const surname = member.surname || "";
    
    if (firstName && surname) {
      return middleName ? `${firstName} ${middleName} ${surname}` : `${firstName} ${surname}`;
    }
    
    return member.name || "Unnamed Member";
  };

  const getStatusConfig = (member) => {
    // Use the status field directly from your database
    const status = member.status || "Inactive";
    return STATUS_CONFIG[status] || STATUS_CONFIG["Inactive"];
  };

  const isNewMember = (member) => {
    // Determine if member is new based on join date or account number
    if (member.accNo) {
      // Assuming lower account numbers are older members
      const accNo = parseInt(member.accNo) || 0;
      return accNo > 100; // Adjust this logic based on your numbering system
    }
    
    // Or check join date if you have it
    if (member.joinDate) {
      const joinDate = new Date(member.joinDate);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return joinDate > thirtyDaysAgo;
    }
    
    return false;
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
    const isCurrentUser = currentUser && item.email === currentUser.email;
    const avatarColor = getRandomColor(item.id);
    const statusConfig = getStatusConfig(item);
    const fullName = getFullName(item);
    const isNew = isNewMember(item);

    return (
      <View
        style={[
          styles.memberCard,
          isCurrentUser && styles.currentUserCard,
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
                <Text style={styles.avatarText}>{getInitials(item)}</Text>
              </View>
            )}
            <View
              style={[
                styles.statusIndicator,
                { backgroundColor: statusConfig.indicatorColor },
              ]}
            />
          </View>

          <View style={[styles.memberInfo, isLandscape && styles.landscapeMemberInfo]}>
            <View style={styles.nameContainer}>
              <Text 
                style={styles.memberName} 
                numberOfLines={1}
              >
                {fullName}
              </Text>
              {isCurrentUser && (
                <View style={styles.youBadge}>
                  <Text style={styles.youText}>You</Text>
                </View>
              )}
              {isNew && item.status === "Active" && (
                <View style={styles.newBadge}>
                  <Text style={styles.newText}>New</Text>
                </View>
              )}
              {item.role && item.role !== "Member" && (
                <View style={styles.roleBadge}>
                  <Text style={styles.roleText}>{item.role}</Text>
                </View>
              )}
            </View>
            <Text 
              style={styles.memberEmail} 
              numberOfLines={1}
            >
              {item.email || "No email"}
            </Text>
            {item.accNo && (
              <Text style={styles.accNoText}>Account #: {item.accNo}</Text>
            )}
          </View>

          <Ionicons
            name="chevron-forward"
            size={responsiveSize(20)}
            color="#CBD5E1"
          />
        </View>

        <View style={styles.cardDetails}>
          <View style={[styles.detailRow, isLandscape && styles.landscapeDetailRow]}>
            <View style={styles.detailItem}>
              <Ionicons
                name="home-outline"
                size={responsiveSize(16)}
                color="#64748B"
              />
              <Text 
                style={styles.detailText} 
                numberOfLines={1}
              >
                {item.address || "Address not specified"}
              </Text>
            </View>

            <View style={styles.detailItem}>
              <Ionicons
                name="call-outline"
                size={responsiveSize(16)}
                color="#64748B"
              />
              <Text 
                style={styles.detailText} 
                numberOfLines={1}
              >
                {item.contact || item.phone || "Not provided"}
              </Text>
            </View>
          </View>

          <View style={[styles.detailRow, isLandscape && styles.landscapeDetailRow]}>
            <View style={styles.detailItem}>
              <Ionicons
                name="person-outline"
                size={responsiveSize(16)}
                color="#64748B"
              />
              <Text 
                style={styles.detailText} 
                numberOfLines={1}
              >
                {item.civilStatus || "Not specified"}
              </Text>
            </View>

            <View style={styles.detailItem}>
              <Ionicons
                name="calendar-outline"
                size={responsiveSize(16)}
                color="#64748B"
              />
              <Text 
                style={styles.detailText} 
                numberOfLines={1}
              >
                {item.dob || "DOB not set"}
              </Text>
            </View>
          </View>

          <View style={styles.statusContainer}>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: statusConfig.bgColor },
              ]}
            >
              <Ionicons
                name={statusConfig.icon}
                size={responsiveSize(14)}
                color={statusConfig.color}
              />
              <Text
                style={[
                  styles.statusText,
                  { color: statusConfig.color },
                ]}
              >
                {statusConfig.label}
              </Text>
            </View>

            {item.accNo && (
              <Text 
                style={styles.joinDate} 
                numberOfLines={1}
              >
                ID: {item.accNo}
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  // Count members by status for the header - only non-deleted members
  const activeMembersCount = members.filter(m => m.status === 'Active').length;
  const newMembersCount = members.filter(m => isNewMember(m) && m.status === 'Active').length;
  const totalMembersCount = members.length; // All members are non-deleted now

  return (
    <View style={styles.container}>
      <View style={[styles.header, isLandscape && styles.landscapeHeader]}>
        <View>
          <Text style={styles.headerTitle}>Community Members</Text>
          <Text style={styles.headerSubtitle}>
            {activeMembersCount} active • {newMembersCount} new • {totalMembersCount} total members
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
  currentUserCard: {
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
    flexWrap: "wrap",
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
    marginRight: 6,
  },
  newBadge: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 6,
  },
  roleBadge: {
    backgroundColor: "#7C3AED",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  youText: {
    color: "white",
    fontSize: 10,
    fontWeight: "600",
  },
  newText: {
    color: "white",
    fontSize: 10,
    fontWeight: "600",
  },
  roleText: {
    color: "white",
    fontSize: 10,
    fontWeight: "600",
  },
  memberEmail: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 2,
  },
  accNoText: {
    fontSize: 12,
    color: "#94a3b8",
    fontStyle: "italic",
  },
  cardDetails: {
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 12,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  landscapeDetailRow: {
    marginBottom: 10,
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
    marginTop: 8,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
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