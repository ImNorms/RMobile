import React, { useEffect, useState } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  ActivityIndicator, 
  Image,
  Dimensions,
  useWindowDimensions
} from "react-native";
import { collection, onSnapshot } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "./firebaseConfig";
import { Ionicons } from "@expo/vector-icons";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Responsive size calculator
const responsiveSize = (size) => {
  const scale = SCREEN_WIDTH / 375; // 375 is typical iPhone width
  return Math.round(size * Math.min(scale, 1.5));
};

export default function MembersScreen() {
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

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getRandomColor = (id) => {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
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

  const renderMemberCard = ({ item, index }) => {
    const isActiveUser = currentUser && item.id === currentUser.uid;
    const avatarColor = getRandomColor(item.id);
    
    return (
      <View style={[
        styles.memberCard,
        isActiveUser && styles.activeUserCard,
        isLandscape && styles.landscapeCard
      ]}>
        <View style={styles.cardHeader}>
          <View style={styles.avatarContainer}>
            {item.photoURL ? (
              <Image 
                source={{ uri: item.photoURL }} 
                style={styles.avatar}
              />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: avatarColor }]}>
                <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
              </View>
            )}
            <View style={[
              styles.statusIndicator,
              isActiveUser ? styles.activeIndicator : styles.inactiveIndicator
            ]} />
          </View>
          
          <View style={[styles.memberInfo, isLandscape && styles.landscapeMemberInfo]}>
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
          <View style={[styles.detailRow, isLandscape && styles.landscapeDetailRow]}>
            <View style={styles.detailItem}>
              <Ionicons name="home-outline" size={responsiveSize(16)} color="#64748B" />
              <Text style={styles.detailText} numberOfLines={1}>
                {item.unitNumber || item.unit || "Unit not specified"}
              </Text>
            </View>
            
            <View style={styles.detailItem}>
              <Ionicons name="call-outline" size={responsiveSize(16)} color="#64748B" />
              <Text style={styles.detailText} numberOfLines={1}>
                {item.phone || item.contactNo || item.contact || "Not provided"}
              </Text>
            </View>
          </View>
          
          <View style={styles.statusContainer}>
            <View style={[
              styles.statusBadge,
              isActiveUser ? styles.activeBadge : styles.inactiveBadge
            ]}>
              <Ionicons 
                name={isActiveUser ? "checkmark-circle" : "time-outline"} 
                size={responsiveSize(14)} 
                color={isActiveUser ? "#059669" : "#DC2626"} 
              />
              <Text style={[
                styles.statusText,
                { color: isActiveUser ? "#059669" : "#DC2626" }
              ]}>
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
            {members.length} {members.length === 1 ? 'neighbor' : 'neighbors'} in your community
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
          isLandscape && styles.landscapeListContainer
        ]}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={responsiveSize(64)} color="#CBD5E1" />
            <Text style={styles.emptyStateTitle}>No members found</Text>
            <Text style={styles.emptyStateText}>
              There are no members in the community yet
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },
  loadingText: {
    marginTop: responsiveSize(16),
    fontSize: responsiveSize(16),
    color: "#64748B",
    fontWeight: "500",
  },
  header: {
    backgroundColor: "#00695C",
    paddingTop: responsiveSize(50),
    paddingBottom: responsiveSize(24),
    paddingHorizontal: Math.max(responsiveSize(24), 16),
    borderBottomLeftRadius: responsiveSize(25),
    borderBottomRightRadius: responsiveSize(25),
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    minHeight: responsiveSize(120),
  },
  landscapeHeader: {
    paddingTop: responsiveSize(40),
    paddingBottom: responsiveSize(20),
    minHeight: responsiveSize(100),
  },
  headerTitle: {
    fontSize: responsiveSize(22),
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: responsiveSize(6),
    textAlign: "center",
  },
  headerSubtitle: {
    fontSize: responsiveSize(14),
    color: "rgba(255,255,255,0.9)",
    fontWeight: "500",
    textAlign: "center",
  },
  headerDecoration: {
    position: "absolute",
    bottom: -responsiveSize(15),
    alignSelf: "center",
    width: responsiveSize(60),
    height: responsiveSize(4),
    backgroundColor: "rgba(255,255,255,0.6)",
    borderRadius: responsiveSize(2),
  },
  listContainer: {
    paddingHorizontal: Math.max(responsiveSize(24), 16),
    paddingBottom: responsiveSize(20),
    paddingTop: responsiveSize(20),
  },
  landscapeListContainer: {
    paddingHorizontal: Math.max(responsiveSize(16), 12),
    paddingTop: responsiveSize(16),
  },
  memberCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: responsiveSize(16),
    padding: responsiveSize(20),
    marginBottom: responsiveSize(16),
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    minHeight: responsiveSize(140),
  },
  landscapeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: responsiveSize(16),
    minHeight: responsiveSize(100),
  },
  activeUserCard: {
    borderLeftWidth: responsiveSize(4),
    borderLeftColor: "#00695C",
    elevation: 6,
    shadowColor: "#00695C",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: responsiveSize(16),
  },
  avatarContainer: {
    position: "relative",
    marginRight: responsiveSize(12),
  },
  avatar: {
    width: responsiveSize(50),
    height: responsiveSize(50),
    borderRadius: responsiveSize(25),
    borderWidth: responsiveSize(2),
    borderColor: "#F1F5F9",
    minWidth: responsiveSize(50),
    minHeight: responsiveSize(50),
  },
  avatarPlaceholder: {
    width: responsiveSize(50),
    height: responsiveSize(50),
    borderRadius: responsiveSize(25),
    justifyContent: "center",
    alignItems: "center",
    borderWidth: responsiveSize(2),
    borderColor: "#F1F5F9",
    minWidth: responsiveSize(50),
    minHeight: responsiveSize(50),
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: responsiveSize(16),
    fontWeight: "bold",
  },
  statusIndicator: {
    position: "absolute",
    bottom: responsiveSize(2),
    right: responsiveSize(2),
    width: responsiveSize(12),
    height: responsiveSize(12),
    borderRadius: responsiveSize(6),
    borderWidth: responsiveSize(2),
    borderColor: "#FFFFFF",
  },
  activeIndicator: {
    backgroundColor: "#10B981",
  },
  inactiveIndicator: {
    backgroundColor: "#EF4444",
  },
  memberInfo: {
    flex: 1,
    minWidth: responsiveSize(100),
  },
  landscapeMemberInfo: {
    flex: 2,
  },
  nameContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: responsiveSize(4),
    flexWrap: 'wrap',
  },
  memberName: {
    fontSize: responsiveSize(18),
    fontWeight: "bold",
    color: "#1E293B",
    marginRight: responsiveSize(8),
    flexShrink: 1,
  },
  youBadge: {
    backgroundColor: "#00695C",
    paddingHorizontal: responsiveSize(8),
    paddingVertical: responsiveSize(2),
    borderRadius: responsiveSize(12),
  },
  youText: {
    color: "#FFFFFF",
    fontSize: responsiveSize(10),
    fontWeight: "bold",
  },
  memberEmail: {
    fontSize: responsiveSize(14),
    color: "#64748B",
    flexShrink: 1,
  },
  cardDetails: {
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: responsiveSize(16),
    flex: 1,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: responsiveSize(12),
  },
  landscapeDetailRow: {
    flexDirection: "column",
    marginBottom: responsiveSize(8),
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: responsiveSize(8),
  },
  detailText: {
    marginLeft: responsiveSize(8),
    fontSize: responsiveSize(14),
    color: "#475569",
    flex: 1,
    flexShrink: 1,
  },
  statusContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: 'wrap',
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: responsiveSize(12),
    paddingVertical: responsiveSize(6),
    borderRadius: responsiveSize(20),
    backgroundColor: "#F8FAFC",
    marginRight: responsiveSize(8),
    marginBottom: responsiveSize(4),
  },
  activeBadge: {
    backgroundColor: "#D1FAE5",
  },
  inactiveBadge: {
    backgroundColor: "#FEE2E2",
  },
  statusText: {
    marginLeft: responsiveSize(4),
    fontSize: responsiveSize(12),
    fontWeight: "600",
  },
  joinDate: {
    fontSize: responsiveSize(12),
    color: "#94A3B8",
    fontWeight: "500",
    flexShrink: 1,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: responsiveSize(60),
    paddingHorizontal: responsiveSize(20),
  },
  emptyStateTitle: {
    fontSize: responsiveSize(18),
    fontWeight: "600",
    color: "#64748B",
    marginTop: responsiveSize(16),
    marginBottom: responsiveSize(8),
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: responsiveSize(14),
    color: "#94A3B8",
    textAlign: "center",
  },
});
