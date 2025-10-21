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
  useWindowDimensions,
  Alert
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { getAuth, signOut } from "firebase/auth";
import { db } from "./firebaseConfig";

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const responsiveSize = (size) => {
  const scale = SCREEN_WIDTH / 375;
  return Math.round(size * Math.min(scale, 1.5));
};

export default function CommitteeScreen({ navigation }) {
  const [selectedCommittee, setSelectedCommittee] = useState("Board of Directors");
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const fadeAnim = useState(new Animated.Value(0))[0];
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const isSmallScreen = width < 375;

  const committees = [
    { name: "Board of Directors", icon: "people", color: "#16A34A", gradient: ["#16A34A", "#22C55E"] },
    { name: "Committee Officers", icon: "briefcase", color: "#15803D", gradient: ["#15803D", "#16A34A"] },
    { name: "Executive Officers", icon: "shield-checkmark", color: "#166534", gradient: ["#166534", "#15803D"] },
  ];

  useEffect(() => {
    if (selectedCommittee === "Board of Directors") {
      fetchBoardOfDirectors();
    } else if (selectedCommittee === "Committee Officers") {
      fetchCommitteeOfficers();
    } else if (selectedCommittee === "Executive Officers") {
      fetchExecutiveOfficers();
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

  const fetchBoardOfDirectors = async () => {
    try {
      setLoading(true);
      fadeAnim.setValue(0);
      // FIXED: Use name field for ordering instead of positionIndex
      const q = query(collection(db, "board_of_directors"), orderBy("name", "asc"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      console.log("Board of Directors data:", data); // Debug log
      setMembers(data);
    } catch (error) {
      console.error("Error fetching board of directors:", error);
      // Fallback: try without ordering
      try {
        const snapshot = await getDocs(collection(db, "board_of_directors"));
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        console.log("Board of Directors data (no ordering):", data);
        setMembers(data);
      } catch (secondError) {
        console.error("Error with fallback fetch:", secondError);
        setMembers([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchCommitteeOfficers = async () => {
    try {
      setLoading(true);
      fadeAnim.setValue(0);
      const snapshot = await getDocs(collection(db, "committee_officers"));
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setMembers(data);
    } catch (error) {
      console.error("Error fetching committee officers:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchExecutiveOfficers = async () => {
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
      console.error("Error fetching executive officers:", error);
    } finally {
      setLoading(false);
    }
  };

  const getCommitteeColor = () => {
    const committee = committees.find(c => c.name === selectedCommittee);
    return committee ? committee.color : "#16A34A";
  };

  const handleLogout = async () => {
    try {
      const auth = getAuth();
      await signOut(auth);
      navigation.reset({
        index: 0,
        routes: [{ name: "Login" }],
      });
    } catch (error) {
      Alert.alert("Logout failed", error.message);
    }
  };

  const CommitteeCard = ({ item, index }) => {
    const isActive = selectedCommittee === item.name;
    const scaleAnim = new Animated.Value(1);
    
    const handlePressIn = () => {
      Animated.spring(scaleAnim, {
        toValue: 0.95,
        useNativeDriver: true,
      }).start();
    };

    const handlePressOut = () => {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
      }).start();
    };

    return (
      <TouchableOpacity
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={() => setSelectedCommittee(item.name)}
        activeOpacity={0.9}
      >
        <Animated.View
          style={[
            styles.committeeCard,
            isSmallScreen && styles.smallCommitteeCard,
            isActive && styles.activeCommitteeCard,
            {
              transform: [{ scale: scaleAnim }],
              borderLeftColor: item.color,
              backgroundColor: isActive ? `${item.color}08` : "#FFFFFF",
            }
          ]}
        >
          <View style={[
            styles.iconContainer,
            isSmallScreen && styles.smallIconContainer,
            isActive && { backgroundColor: item.color }
          ]}>
            <Ionicons
              name={item.icon}
              size={isSmallScreen ? responsiveSize(20) : responsiveSize(24)}
              color={isActive ? "#FFFFFF" : item.color}
            />
          </View>
          <Text
            style={[
              styles.committeeName,
              isSmallScreen && styles.smallCommitteeName,
              isActive && [styles.activeCommitteeName, { color: item.color }]
            ]}
            numberOfLines={2}
          >
            {item.name}
          </Text>
          {isActive && (
            <View style={[styles.activeIndicator, { backgroundColor: item.color }]} />
          )}
        </Animated.View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Modern Header with Updated Color */}
      <View style={[styles.header, isLandscape && styles.landscapeHeader]}>
        <View style={styles.headerBackground} />
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Community Leadership</Text>
          <Text style={styles.headerSubtitle}>Meet your dedicated team</Text>
        </View>
        <View style={styles.headerDecoration}>
          <View style={[styles.decorationDot, { backgroundColor: '#16A34A' }]} />
          <View style={[styles.decorationDot, { backgroundColor: '#15803D' }]} />
          <View style={[styles.decorationDot, { backgroundColor: '#166534' }]} />
        </View>
      </View>

      {/* Committee Selection - Compact Horizontal Scroll */}
      <View style={styles.committeeSection}>
        <Text style={styles.committeeSectionTitle}>Select Committee</Text>
        <ScrollView 
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.committeeScrollContainer}
        >
          {committees.map((item, index) => (
            <CommitteeCard key={index} item={item} index={index} />
          ))}
        </ScrollView>
      </View>

      {/* Members Section */}
      <View style={[styles.membersContainer, isLandscape && styles.landscapeMembersContainer]}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>{selectedCommittee}</Text>
            <View style={[styles.memberCount, { backgroundColor: getCommitteeColor() }]}>
              <Text style={styles.memberCountText}>{members.length}</Text>
            </View>
          </View>
          <View style={[styles.sectionLine, { backgroundColor: getCommitteeColor() }]} />
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={getCommitteeColor()} />
            <Text style={styles.loadingText}>Loading team members...</Text>
          </View>
        ) : (
          <Animated.ScrollView 
            style={{ opacity: fadeAnim }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.membersList}
          >
            {members.length > 0 ? (
              members.map((member, index) => (
                <View 
                  key={member.id || index} 
                  style={[
                    styles.memberCard,
                    { borderLeftColor: getCommitteeColor() }
                  ]}
                >
                  <View style={styles.memberHeader}>
                    <View style={styles.imageContainer}>
                      <Image
                        source={{ uri: member.photoURL || "https://via.placeholder.com/80" }}
                        style={styles.memberImage}
                        defaultSource={{ uri: "https://via.placeholder.com/80" }}
                      />
                      <View style={[styles.statusIndicator, { backgroundColor: getCommitteeColor() }]} />
                    </View>
                    <View style={styles.memberBasicInfo}>
                      <Text style={styles.memberName} numberOfLines={1}>
                        {member.name}
                      </Text>
                      <Text style={[styles.memberRole, { color: getCommitteeColor() }]} numberOfLines={1}>
                        {member.position}
                      </Text>
                      <View style={styles.contactIcons}>
                        {member.contactNo && (
                          <Ionicons name="call" size={16} color="#64748B" />
                        )}
                        {member.email && (
                          <Ionicons name="mail" size={16} color="#64748B" style={styles.contactIcon} />
                        )}
                      </View>
                    </View>
                  </View>
                  
                  <View style={styles.memberDetails}>
                    {(member.contactNo || member.email) && (
                      <View style={styles.detailRow}>
                        {member.contactNo && (
                          <View style={styles.detailItem}>
                            <Ionicons name="call-outline" size={16} color="#64748B" />
                            <Text style={styles.detailText} numberOfLines={1}>
                              {member.contactNo}
                            </Text>
                          </View>
                        )}
                        {member.email && (
                          <View style={styles.detailItem}>
                            <Ionicons name="mail-outline" size={16} color="#64748B" />
                            <Text style={styles.detailText} numberOfLines={1}>
                              {member.email}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                    
                    <View style={styles.detailRow}>
                      <View style={styles.detailItem}>
                        <Ionicons name="calendar-outline" size={16} color="#64748B" />
                        <Text style={styles.detailText} numberOfLines={1}>
                          {member.dateElected || "Elected: N/A"}
                        </Text>
                      </View>
                      <View style={styles.detailItem}>
                        <Ionicons name="time-outline" size={16} color="#64748B" />
                        <Text style={styles.detailText} numberOfLines={1}>
                          {member.termDuration || "Term: N/A"}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyState}>
                <View style={[styles.emptyIcon, { backgroundColor: `${getCommitteeColor()}15` }]}>
                  <Ionicons name="people-outline" size={48} color={getCommitteeColor()} />
                </View>
                <Text style={styles.emptyStateText}>No members found</Text>
                <Text style={styles.emptyStateSubtext}>
                  There are no members in this committee yet
                </Text>
              </View>
            )}
          </Animated.ScrollView>
        )}
      </View>

      {/* Footer - Same as MembersScreen */}
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
    paddingTop: responsiveSize(50),
    paddingBottom: responsiveSize(20),
    paddingHorizontal: 24,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: 'hidden',
    minHeight: responsiveSize(140),
  },
  headerBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#004d40', // Updated to match MembersScreen header color
  },
  landscapeHeader: {
    paddingTop: responsiveSize(35),
    paddingBottom: responsiveSize(15),
    minHeight: responsiveSize(110),
  },
  headerContent: { 
    alignItems: "center",
    zIndex: 1,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: responsiveSize(28),
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    color: "rgba(255,255,255,0.9)",
    fontSize: responsiveSize(16),
    textAlign: "center",
    fontWeight: "500",
  },
  headerDecoration: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
    zIndex: 1,
  },
  decorationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  committeeSection: {
    marginTop: 8,
    marginBottom: 8,
  },
  committeeSectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E293B",
    marginLeft: 20,
    marginBottom: 8,
  },
  committeeScrollContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  committeeCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 4,
    width: 140,
    borderLeftWidth: 3,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    position: 'relative',
    minHeight: 120,
  },
  smallCommitteeCard: {
    width: 120,
    padding: 12,
    minHeight: 100,
  },
  activeCommitteeCard: {
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#F0FDF4",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  smallIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },
  committeeName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
    textAlign: "left",
    lineHeight: 16,
  },
  smallCommitteeName: {
    fontSize: 12,
    lineHeight: 14,
  },
  activeCommitteeName: {
    color: "#1E293B",
  },
  activeIndicator: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  membersContainer: {
    flex: 1,
    padding: 16,
    marginTop: 0,
    paddingBottom: 80, // Added padding to accommodate footer
  },
  landscapeMembersContainer: {
    paddingHorizontal: 12,
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1E293B",
    letterSpacing: -0.5,
  },
  memberCount: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  memberCountText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  sectionLine: {
    width: 40,
    height: 3,
    borderRadius: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#64748B",
    fontWeight: "500",
  },
  membersList: {
    paddingBottom: 16,
  },
  memberCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    borderLeftWidth: 3,
  },
  memberHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  imageContainer: {
    position: 'relative',
    marginRight: 12,
  },
  memberImage: {
    width: 56,
    height: 56,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#F1F5F9",
  },
  statusIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  memberBasicInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 4,
  },
  memberRole: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
  },
  contactIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactIcon: {
    marginLeft: 6,
  },
  memberDetails: {
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 12,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  detailText: {
    fontSize: 13,
    color: "#64748B",
    marginLeft: 6,
    flex: 1,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#64748B",
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 20,
  },
  // Footer styles from MembersScreen
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