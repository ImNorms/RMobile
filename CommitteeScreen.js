import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Animated,
  Dimensions,
  useWindowDimensions
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "./firebaseConfig";

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const responsiveSize = (size) => {
  const scale = SCREEN_WIDTH / 375;
  return Math.round(size * Math.min(scale, 1.5));
};

export default function CommitteeScreen() {
  const [selectedCommittee, setSelectedCommittee] = useState("HOA Board of Members");
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const fadeAnim = useState(new Animated.Value(0))[0];
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const isSmallScreen = width < 375;

  const committees = [
    { name: "HOA Board of Members", icon: "people", color: "#00695C" },
    { name: "Waste Management", icon: "trash", color: "#4CAF50" },
    { name: "Security Committee", icon: "shield-checkmark", color: "#2196F3" },
    { name: "Sport committee", icon: "football", color: "#FF6B35" },
  ];

  useEffect(() => {
    if (selectedCommittee === "HOA Board of Members") {
      fetchElectedOfficials();
    } else if (selectedCommittee === "Waste Management") {
      fetchWasteCommittee();
    } else if (selectedCommittee === "Sport committee") {
      fetchSportCommittee();
    } else if (selectedCommittee === "Security Committee") {
      fetchSecurityCommittee();
    } else {
      setMembers([]);
    }
  }, [selectedCommittee]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [members]);

  const fetchElectedOfficials = async () => {
    try {
      setLoading(true);
      fadeAnim.setValue(0);
      const q = query(collection(db, "elected_officials"), orderBy("positionIndex", "asc"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setMembers(data);
    } catch (error) {
      console.error("Error fetching elected officials:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWasteCommittee = async () => {
    try {
      setLoading(true);
      fadeAnim.setValue(0);
      const snapshot = await getDocs(collection(db, "waste_committee_members"));
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setMembers(data);
    } catch (error) {
      console.error("Error fetching waste committee members:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSportCommittee = async () => {
    try {
      setLoading(true);
      fadeAnim.setValue(0);
      const snapshot = await getDocs(collection(db, "sport_committee_members"));
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setMembers(data);
    } catch (error) {
      console.error("Error fetching sport committee members:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSecurityCommittee = async () => {
    try {
      setLoading(true);
      fadeAnim.setValue(0);
      const snapshot = await getDocs(collection(db, "security_committee_members"));
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setMembers(data);
    } catch (error) {
      console.error("Error fetching security committee members:", error);
    } finally {
      setLoading(false);
    }
  };

  const getCommitteeColor = () => {
    const committee = committees.find(c => c.name === selectedCommittee);
    return committee ? committee.color : "#00695C";
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: getCommitteeColor() }, isLandscape && styles.landscapeHeader]}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>HOA Committees</Text>
          <Text style={styles.headerSubtitle}>Meet your community leaders</Text>
        </View>
        <View style={styles.headerDecoration} />
      </View>

      {/* Committee Selection Grid */}
      <View style={[styles.committeeGrid, isLandscape && styles.landscapeCommitteeGrid]}>
        {committees.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.committeeCard,
              isSmallScreen && styles.smallCommitteeCard,
              selectedCommittee === item.name && [
                styles.activeCommitteeCard,
                { borderColor: item.color, backgroundColor: `${item.color}15` }
              ],
            ]}
            onPress={() => setSelectedCommittee(item.name)}
          >
            <View style={[
              styles.iconContainer,
              isSmallScreen && styles.smallIconContainer,
              selectedCommittee === item.name && [
                styles.activeIconContainer,
                { backgroundColor: item.color }
              ]
            ]}>
              <Ionicons
                name={item.icon}
                size={isSmallScreen ? responsiveSize(18) : responsiveSize(20)}
                color={selectedCommittee === item.name ? "#fff" : item.color}
              />
            </View>
            <Text
              style={[
                styles.committeeName,
                isSmallScreen && styles.smallCommitteeName,
                selectedCommittee === item.name && [
                  styles.activeCommitteeName,
                  { color: item.color }
                ]
              ]}
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {item.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Members Section */}
      <View style={[styles.membersContainer, isLandscape && styles.landscapeMembersContainer]}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{selectedCommittee}</Text>
          <View style={[styles.sectionLine, { backgroundColor: getCommitteeColor() }]} />
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={getCommitteeColor()} />
            <Text style={styles.loadingText}>Loading members...</Text>
          </View>
        ) : (
          <Animated.ScrollView 
            style={{ opacity: fadeAnim }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.membersList,
              isLandscape && styles.landscapeMembersList
            ]}
          >
            {members.length > 0 ? (
              members.map((member, index) => (
                <View 
                  key={member.id || index} 
                  style={[
                    styles.memberCard,
                    isLandscape && styles.landscapeMemberCard,
                    { borderLeftColor: getCommitteeColor() }
                  ]}
                >
                  <View style={[styles.memberHeader, isLandscape && styles.landscapeMemberHeader]}>
                    <Image
                      source={{ uri: member.photoURL || "https://via.placeholder.com/60" }}
                      style={[styles.memberImage, isSmallScreen && styles.smallMemberImage]}
                      defaultSource={{ uri: "https://via.placeholder.com/60" }}
                    />
                    <View style={[styles.memberBasicInfo, isLandscape && styles.landscapeMemberBasicInfo]}>
                      <Text style={[styles.memberName, isSmallScreen && styles.smallMemberName]} numberOfLines={1}>
                        {member.name}
                      </Text>
                      <Text style={[styles.memberRole, { color: getCommitteeColor() }, isSmallScreen && styles.smallMemberRole]} numberOfLines={1}>
                        {member.role}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={[styles.memberDetails, isLandscape && styles.landscapeMemberDetails]}>
                    <View style={[styles.detailRow, isLandscape && styles.landscapeDetailRow]}>
                      <View style={styles.detailItem}>
                        <Ionicons name="call-outline" size={responsiveSize(16)} color="#666" style={styles.detailIcon} />
                        <Text style={[styles.detailText, isSmallScreen && styles.smallDetailText]} numberOfLines={1}>
                          {member.contactNo || "Not provided"}
                        </Text>
                      </View>
                      <View style={styles.detailItem}>
                        <Ionicons name="mail-outline" size={responsiveSize(16)} color="#666" style={styles.detailIcon} />
                        <Text style={[styles.detailText, isSmallScreen && styles.smallDetailText]} numberOfLines={1}>
                          {member.email || "Not provided"}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.detailRow, isLandscape && styles.landscapeDetailRow]}>
                      <View style={styles.detailItem}>
                        <Ionicons name="calendar-outline" size={responsiveSize(16)} color="#666" style={styles.detailIcon} />
                        <Text style={[styles.detailText, isSmallScreen && styles.smallDetailText]} numberOfLines={1}>
                          Elected: {member.dateElected || "N/A"}
                        </Text>
                      </View>
                      <View style={styles.detailItem}>
                        <Ionicons name="time-outline" size={responsiveSize(16)} color="#666" style={styles.detailIcon} />
                        <Text style={[styles.detailText, isSmallScreen && styles.smallDetailText]} numberOfLines={1}>
                          Term: {member.termDuration || "N/A"}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={responsiveSize(64)} color="#ddd" />
                <Text style={styles.emptyStateText}>No members found</Text>
                <Text style={styles.emptyStateSubtext}>
                  There are no members in this committee yet
                </Text>
              </View>
            )}
          </Animated.ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    paddingTop: responsiveSize(50),
    paddingBottom: responsiveSize(24),
    paddingHorizontal: Math.max(responsiveSize(20), 16),
    borderBottomLeftRadius: responsiveSize(25),
    borderBottomRightRadius: responsiveSize(25),
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    minHeight: responsiveSize(130),
  },
  landscapeHeader: {
    paddingTop: responsiveSize(35),
    paddingBottom: responsiveSize(18),
    minHeight: responsiveSize(100),
  },
  headerContent: { alignItems: "center" },
  headerTitle: {
    color: "#fff",
    fontSize: responsiveSize(22),
    fontWeight: "bold",
    marginBottom: responsiveSize(6),
    textAlign: "center",
  },
  headerSubtitle: {
    color: "rgba(255,255,255,0.9)",
    fontSize: responsiveSize(14),
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
  committeeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    padding: Math.max(responsiveSize(16), 12),
    marginTop: -responsiveSize(10),
  },
  landscapeCommitteeGrid: {
    paddingHorizontal: Math.max(responsiveSize(12), 8),
    marginTop: -responsiveSize(5),
  },
  committeeCard: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: responsiveSize(16),
    padding: responsiveSize(16),
    alignItems: "center",
    marginBottom: responsiveSize(12),
    borderWidth: responsiveSize(2),
    borderColor: "transparent",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    minHeight: responsiveSize(100),
  },
  smallCommitteeCard: {
    padding: responsiveSize(12),
    minHeight: responsiveSize(90),
  },
  activeCommitteeCard: {
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    transform: [{ scale: 1.02 }],
  },
  iconContainer: {
    width: responsiveSize(50),
    height: responsiveSize(50),
    borderRadius: responsiveSize(25),
    backgroundColor: "#f8f9fa",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: responsiveSize(8),
    minWidth: responsiveSize(50),
    minHeight: responsiveSize(50),
  },
  smallIconContainer: {
    width: responsiveSize(40),
    height: responsiveSize(40),
    borderRadius: responsiveSize(20),
    minWidth: responsiveSize(40),
    minHeight: responsiveSize(40),
  },
  activeIconContainer: {
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  committeeName: {
    fontSize: responsiveSize(13),
    fontWeight: "600",
    color: "#64748b",
    textAlign: "center",
    lineHeight: responsiveSize(16),
  },
  smallCommitteeName: {
    fontSize: responsiveSize(11),
    lineHeight: responsiveSize(14),
  },
  activeCommitteeName: {
    fontWeight: "bold",
  },
  membersContainer: {
    flex: 1,
    padding: Math.max(responsiveSize(16), 12),
  },
  landscapeMembersContainer: {
    paddingHorizontal: Math.max(responsiveSize(12), 8),
  },
  sectionHeader: {
    marginBottom: responsiveSize(20),
  },
  sectionTitle: {
    fontSize: responsiveSize(22),
    fontWeight: "bold",
    color: "#1e293b",
    marginBottom: responsiveSize(8),
  },
  sectionLine: {
    width: responsiveSize(40),
    height: responsiveSize(4),
    borderRadius: responsiveSize(2),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: responsiveSize(12),
    fontSize: responsiveSize(16),
    color: "#64748b",
    fontWeight: "500",
  },
  membersList: {
    paddingBottom: responsiveSize(20),
  },
  landscapeMembersList: {
    paddingBottom: responsiveSize(15),
  },
  memberCard: {
    backgroundColor: "#fff",
    borderRadius: responsiveSize(16),
    padding: responsiveSize(16),
    marginBottom: responsiveSize(16),
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    borderLeftWidth: responsiveSize(4),
    minHeight: responsiveSize(140),
  },
  landscapeMemberCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: responsiveSize(12),
    minHeight: responsiveSize(120),
  },
  memberHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: responsiveSize(12),
  },
  landscapeMemberHeader: {
    flex: 1,
    marginBottom: 0,
    marginRight: responsiveSize(12),
  },
  memberImage: {
    width: responsiveSize(60),
    height: responsiveSize(60),
    borderRadius: responsiveSize(30),
    marginRight: responsiveSize(12),
    borderWidth: responsiveSize(2),
    borderColor: "#f1f5f9",
    minWidth: responsiveSize(60),
    minHeight: responsiveSize(60),
  },
  smallMemberImage: {
    width: responsiveSize(50),
    height: responsiveSize(50),
    borderRadius: responsiveSize(25),
    minWidth: responsiveSize(50),
    minHeight: responsiveSize(50),
  },
  memberBasicInfo: {
    flex: 1,
  },
  landscapeMemberBasicInfo: {
    flex: 1,
    minWidth: responsiveSize(120),
  },
  memberName: {
    fontSize: responsiveSize(18),
    fontWeight: "bold",
    color: "#1e293b",
    marginBottom: responsiveSize(4),
  },
  smallMemberName: {
    fontSize: responsiveSize(16),
  },
  memberRole: {
    fontSize: responsiveSize(14),
    fontWeight: "600",
  },
  smallMemberRole: {
    fontSize: responsiveSize(12),
  },
  memberDetails: {
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: responsiveSize(12),
  },
  landscapeMemberDetails: {
    borderTopWidth: 0,
    borderLeftWidth: 1,
    borderLeftColor: "#f1f5f9",
    paddingTop: 0,
    paddingLeft: responsiveSize(12),
    flex: 1,
  },
  detailRow: {
    marginBottom: responsiveSize(8),
  },
  landscapeDetailRow: {
    marginBottom: responsiveSize(6),
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: responsiveSize(6),
    flex: 1,
  },
  detailIcon: {
    marginRight: responsiveSize(8),
    width: responsiveSize(20),
  },
  detailText: {
    fontSize: responsiveSize(14),
    color: "#475569",
    flex: 1,
    flexShrink: 1,
  },
  smallDetailText: {
    fontSize: responsiveSize(12),
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: responsiveSize(60),
    paddingHorizontal: Math.max(responsiveSize(40), 20),
  },
  emptyStateText: {
    fontSize: responsiveSize(18),
    fontWeight: "600",
    color: "#64748b",
    marginTop: responsiveSize(16),
    marginBottom: responsiveSize(8),
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: responsiveSize(14),
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: responsiveSize(20),
  },
});