import React, { useEffect, useState } from "react";
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Dimensions,
  useWindowDimensions,
  StatusBar,
  Alert
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { db } from "./firebaseConfig";
import { collection, onSnapshot } from "firebase/firestore";
import { getAuth, signOut } from "firebase/auth";

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Responsive size calculator
const responsiveSize = (size) => {
  const scale = SCREEN_WIDTH / 375;
  return Math.round(size * Math.min(scale, 1.5));
};

export default function VotingScreen({ navigation }) {
  const [firstElectionId, setFirstElectionId] = useState(null);
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const isSmallScreen = width < 375;
  const isTablet = width > 768;

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "elections"), (snap) => {
      if (!snap.empty) {
        setFirstElectionId(snap.docs[0].id);
      }
    });
    return unsubscribe;
  }, []);

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

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#00695C" barStyle="light-content" />
      
      {/* Header - Moved outside SafeAreaView to be at very top */}
      <View style={[
        styles.header,
        isLandscape && styles.landscapeHeader,
        isTablet && styles.tabletHeader
      ]}>
        <Text style={[
          styles.headerTitle,
          isSmallScreen && styles.smallHeaderTitle,
          isTablet && styles.tabletHeaderTitle
        ]}>Voting</Text>
      </View>

      {/* Main Content */}
      <SafeAreaView style={styles.mainContent} edges={['left', 'right', 'bottom']}>
        {/* Menu Container */}
        <View style={[
          styles.menuContainer,
          isLandscape && styles.landscapeMenuContainer,
          isTablet && styles.tabletMenuContainer
        ]}>
          <TouchableOpacity
            style={[
              styles.card, 
              { borderLeftColor: "#00695C" },
              isSmallScreen && styles.smallCard,
              isTablet && styles.tabletCard
            ]}
            onPress={() =>
              firstElectionId &&
              navigation.navigate("ElectionStatus", { eventId: firstElectionId })
            }
          >
            <View style={[
              styles.cardContent,
              isSmallScreen && styles.smallCardContent
            ]}>
              <Ionicons 
                name="stats-chart" 
                size={isSmallScreen ? responsiveSize(24) : isTablet ? responsiveSize(32) : responsiveSize(28)} 
                color="#00695C" 
              />
              <Text style={[
                styles.cardText,
                isSmallScreen && styles.smallCardText,
                isTablet && styles.tabletCardText
              ]}>Election Status</Text>
            </View>
            <Ionicons 
              name="chevron-forward" 
              size={isSmallScreen ? responsiveSize(20) : responsiveSize(24)} 
              color="#00695C" 
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.card, 
              { borderLeftColor: "#2E7D32" },
              isSmallScreen && styles.smallCard,
              isTablet && styles.tabletCard
            ]}
            onPress={() =>
              firstElectionId && navigation.navigate("Elections", { eventId: firstElectionId })
            }
          >
            <View style={[
              styles.cardContent,
              isSmallScreen && styles.smallCardContent
            ]}>
              <Ionicons 
                name="people" 
                size={isSmallScreen ? responsiveSize(24) : isTablet ? responsiveSize(32) : responsiveSize(28)} 
                color="#2E7D32" 
              />
              <Text style={[
                styles.cardText,
                isSmallScreen && styles.smallCardText,
                isTablet && styles.tabletCardText
              ]}>Board of Directors Election</Text>
            </View>
            <Ionicons 
              name="chevron-forward" 
              size={isSmallScreen ? responsiveSize(20) : responsiveSize(24)} 
              color="#2E7D32" 
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.card, 
              { borderLeftColor: "#FBC02D" },
              isSmallScreen && styles.smallCard,
              isTablet && styles.tabletCard
            ]}
            onPress={() =>
              firstElectionId && navigation.navigate("MyVotes", { eventId: firstElectionId })
            }
          >
            <View style={[
              styles.cardContent,
              isSmallScreen && styles.smallCardContent
            ]}>
              <Ionicons 
                name="clipboard" 
                size={isSmallScreen ? responsiveSize(24) : isTablet ? responsiveSize(32) : responsiveSize(28)} 
                color="#FBC02D" 
              />
              <Text style={[
                styles.cardText,
                isSmallScreen && styles.smallCardText,
                isTablet && styles.tabletCardText
              ]}>View My Votes</Text>
            </View>
            <Ionicons 
              name="chevron-forward" 
              size={isSmallScreen ? responsiveSize(20) : responsiveSize(24)} 
              color="#FBC02D" 
            />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Footer - Fixed at bottom */}
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

        <TouchableOpacity
          style={styles.footerButton}
          onPress={handleLogout}
        >
          <Ionicons name="log-out" size={22} color="#fff" />
          <Text style={styles.footerText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#f8fafc" 
  },
  header: {
    backgroundColor: "#00695C",
    paddingTop: responsiveSize(40), // Increased padding to account for status bar
    paddingBottom: responsiveSize(15),
    paddingHorizontal: Math.max(responsiveSize(20), 16),
    borderBottomLeftRadius: responsiveSize(20),
    borderBottomRightRadius: responsiveSize(20),
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  landscapeHeader: {
    paddingTop: responsiveSize(30),
    paddingBottom: responsiveSize(10),
  },
  tabletHeader: {
    paddingTop: responsiveSize(45),
    paddingBottom: responsiveSize(20),
  },
  headerTitle: {
    fontSize: responsiveSize(22),
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
  },
  smallHeaderTitle: {
    fontSize: responsiveSize(20),
  },
  tabletHeaderTitle: {
    fontSize: responsiveSize(26),
  },
  mainContent: {
    flex: 1,
  },
  menuContainer: { 
    flex: 1, 
    padding: Math.max(responsiveSize(20), 16),
    paddingTop: responsiveSize(20),
  },
  landscapeMenuContainer: {
    padding: responsiveSize(16),
    paddingTop: responsiveSize(15),
  },
  tabletMenuContainer: {
    padding: responsiveSize(30),
    paddingTop: responsiveSize(25),
  },
  card: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: responsiveSize(16),
    padding: responsiveSize(20),
    marginBottom: responsiveSize(16),
    borderLeftWidth: responsiveSize(6),
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    minHeight: responsiveSize(80),
  },
  smallCard: {
    padding: responsiveSize(16),
    marginBottom: responsiveSize(12),
    borderRadius: responsiveSize(12),
    minHeight: responsiveSize(70),
  },
  tabletCard: {
    padding: responsiveSize(24),
    marginBottom: responsiveSize(20),
    borderRadius: responsiveSize(20),
    minHeight: responsiveSize(90),
  },
  cardContent: { 
    flexDirection: "row", 
    alignItems: "center",
    flex: 1,
  },
  smallCardContent: {
    flex: 1,
  },
  cardText: { 
    marginLeft: responsiveSize(12), 
    fontSize: responsiveSize(18), 
    fontWeight: "600", 
    color: "#1e293b",
    flex: 1,
    flexWrap: 'wrap',
  },
  smallCardText: {
    fontSize: responsiveSize(16),
    marginLeft: responsiveSize(10),
  },
  tabletCardText: {
    fontSize: responsiveSize(20),
    marginLeft: responsiveSize(16),
  },

  // Footer Styles
  footer: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    backgroundColor: "#00695C",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#004D40",
  },
  footerButton: {
    alignItems: "center",
    paddingHorizontal: 10,
  },
  footerText: {
    color: "#fff",
    fontSize: 12,
    marginTop: 4,
    fontWeight: "500",
  },
});