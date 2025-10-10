import React, { useEffect, useState } from "react";
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Dimensions,
  useWindowDimensions,
  StatusBar 
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { db } from "./firebaseConfig";
import { collection, onSnapshot } from "firebase/firestore";

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

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <StatusBar backgroundColor="#00695C" barStyle="light-content" />
      
      {/* Header */}
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
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#f8fafc" 
  },
  header: {
    backgroundColor: "#00695C",
    paddingTop: responsiveSize(50), // Reduced from 60
    paddingBottom: responsiveSize(20),
    paddingHorizontal: Math.max(responsiveSize(20), 16),
    borderBottomLeftRadius: responsiveSize(25),
    borderBottomRightRadius: responsiveSize(25),
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  landscapeHeader: {
    paddingTop: responsiveSize(30), // Reduced from 40
    paddingBottom: responsiveSize(15),
  },
  tabletHeader: {
    paddingTop: responsiveSize(50), // Reduced from 70
    paddingBottom: responsiveSize(25),
  },
  headerTitle: {
    fontSize: responsiveSize(28),
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
  },
  smallHeaderTitle: {
    fontSize: responsiveSize(24),
  },
  tabletHeaderTitle: {
    fontSize: responsiveSize(32),
  },
  menuContainer: { 
    flex: 1, 
    padding: Math.max(responsiveSize(20), 16),
    paddingTop: responsiveSize(20), // Reduced from 30
  },
  landscapeMenuContainer: {
    padding: responsiveSize(16),
    paddingTop: responsiveSize(15), // Reduced from 20
  },
  tabletMenuContainer: {
    padding: responsiveSize(30),
    paddingTop: responsiveSize(25), // Reduced from 40
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
});