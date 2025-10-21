import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Image, TouchableOpacity, Dimensions } from "react-native";
import { collection, query, where, onSnapshot, doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebaseConfig";
import { Ionicons } from "@expo/vector-icons";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const responsiveSize = (size) => {
  const scale = SCREEN_WIDTH / 375;
  return Math.round(size * Math.min(scale, 1.5));
};

export default function AccountingScreen() {
  const [contributions, setContributions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userAccount, setUserAccount] = useState(null);
  const [totalContributions, setTotalContributions] = useState(0);
  const [expandedItem, setExpandedItem] = useState(null);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    const getUserAccountNumber = async () => {
      try {
        const memberRef = doc(db, "members", user.uid);
        const memberSnap = await getDoc(memberRef);

        if (memberSnap.exists()) {
          const accNo = memberSnap.data().accNo;
          setUserAccount(accNo);
        }
      } catch (error) {
        console.error("Error getting user account:", error);
        setLoading(false);
      }
    };

    getUserAccountNumber();
  }, []);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user || !userAccount) {
      return;
    }

    const q = query(
      collection(db, "contributions"),
      where("accNo", "==", userAccount)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setContributions(data);
        
        // Calculate total contributions
        const total = data.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
        setTotalContributions(total);
        
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching contributions:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userAccount]);

  const toggleExpand = (id) => {
    setExpandedItem(expandedItem === id ? null : id);
  };

  const formatCurrency = (amount) => {
    return `₱${parseFloat(amount).toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed': return '#22C55E';
      case 'pending': return '#F59E0B';
      case 'failed': return '#EF4444';
      default: return '#22C55E';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00695C" />
        <Text style={styles.loadingText}>Loading contributions...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Contributions</Text>
        <Text style={styles.headerSubtitle}>Account: {userAccount || 'N/A'}</Text>
      </View>

      {/* Summary Card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryItem}>
          <View style={styles.summaryIcon}>
            <Ionicons name="wallet-outline" size={24} color="#00695C" />
          </View>
          <Text style={styles.summaryLabel}>Total Contributions</Text>
          <Text style={styles.summaryValue}>{formatCurrency(totalContributions)}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <View style={styles.summaryIcon}>
            <Ionicons name="receipt-outline" size={24} color="#00695C" />
          </View>
          <Text style={styles.summaryLabel}>Total Transactions</Text>
          <Text style={styles.summaryValue}>{contributions.length}</Text>
        </View>
      </View>

      {contributions.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyStateIcon}>
            <Ionicons name="document-text-outline" size={64} color="#CBD5E1" />
          </View>
          <Text style={styles.emptyStateTitle}>No contributions found</Text>
          <Text style={styles.emptyStateText}>
            Your contribution history will appear here once you make your first payment.
          </Text>
        </View>
      ) : (
        <FlatList
          data={contributions}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.card}
              onPress={() => toggleExpand(item.id)}
              activeOpacity={0.9}
            >
              <View style={styles.cardHeader}>
                <View style={styles.cardLeft}>
                  <View style={styles.monthContainer}>
                    <Ionicons name="calendar-outline" size={16} color="#00695C" />
                    <Text style={styles.monthYear}>{item.monthYear}</Text>
                  </View>
                  <Text style={styles.name}>{item.name}</Text>
                </View>
                <View style={styles.cardRight}>
                  <Text style={styles.amount}>{formatCurrency(item.amount)}</Text>
                  <Ionicons 
                    name={expandedItem === item.id ? "chevron-up" : "chevron-down"} 
                    size={20} 
                    color="#00695C" 
                  />
                </View>
              </View>

              {expandedItem === item.id && (
                <View style={styles.cardDetails}>
                  <View style={styles.detailRow}>
                    <Ionicons name="card-outline" size={18} color="#00695C" />
                    <Text style={styles.detailLabel}>Payment Method:</Text>
                    <Text style={styles.detailValue}>{item.paymentMethod}</Text>
                  </View>
                  
                  <View style={styles.detailRow}>
                    <Ionicons name="person-outline" size={18} color="#00695C" />
                    <Text style={styles.detailLabel}>Recipient:</Text>
                    <Text style={styles.detailValue}>{item.recipient}</Text>
                  </View>
                  
                  <View style={styles.detailRow}>
                    <Ionicons name="time-outline" size={18} color="#00695C" />
                    <Text style={styles.detailLabel}>Transaction Date:</Text>
                    <Text style={styles.detailValue}>
                      {item.transactionDate?.toDate
                        ? item.transactionDate.toDate().toLocaleDateString('en-PH', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })
                        : "N/A"}
                    </Text>
                  </View>

                  {item.status && (
                    <View style={styles.detailRow}>
                      <Ionicons name="checkmark-circle-outline" size={18} color="#00695C" />
                      <Text style={styles.detailLabel}>Status:</Text>
                      <Text style={[styles.detailValue, { color: getStatusColor(item.status) }]}>
                        {item.status}
                      </Text>
                    </View>
                  )}

                  {item.proofURL && (
                    <View style={styles.proofSection}>
                      <View style={styles.proofHeader}>
                        <Ionicons name="image-outline" size={18} color="#00695C" />
                        <Text style={styles.proofLabel}>Proof of Payment</Text>
                      </View>
                      <Image source={{ uri: item.proofURL }} style={styles.image} />
                    </View>
                  )}
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },
  loadingText: {
    marginTop: 12,
    fontSize: responsiveSize(16),
    color: "#00695C",
  },
  header: {
    backgroundColor: "#00695C",
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 16,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  headerTitle: {
    color: "#fff",
    fontSize: responsiveSize(22),
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: responsiveSize(16),
    color: "#E0F2F1",
    opacity: 0.9,
  },
  summaryCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    marginHorizontal: 20,
    marginTop: -20,
    borderRadius: 16,
    padding: 20,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    borderLeftWidth: 4,
    borderLeftColor: "#00695C",
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
  },
  summaryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#E0F2F1",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: responsiveSize(14),
    color: "#64748b",
    marginBottom: 8,
    textAlign: "center",
  },
  summaryValue: {
    fontSize: responsiveSize(20),
    fontWeight: "bold",
    color: "#00695C",
  },
  summaryDivider: {
    width: 1,
    backgroundColor: "#e2e8f0",
    marginHorizontal: 10,
  },
  listContent: {
    padding: 20,
    paddingTop: 15,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: "#00695C",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardLeft: {
    flex: 1,
  },
  cardRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  monthContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  monthYear: {
    fontSize: responsiveSize(16),
    fontWeight: "600",
    color: "#004d40",
  },
  name: {
    fontSize: responsiveSize(14),
    color: "#64748b",
  },
  amount: {
    fontSize: responsiveSize(18),
    fontWeight: "bold",
    color: "#00695C",
  },
  cardDetails: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 10,
  },
  detailLabel: {
    fontSize: responsiveSize(14),
    color: "#64748b",
    fontWeight: "500",
    width: 120,
  },
  detailValue: {
    fontSize: responsiveSize(14),
    color: "#1e293b",
    flex: 1,
    fontWeight: "500",
  },
  proofSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  proofHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  proofLabel: {
    fontSize: responsiveSize(14),
    color: "#64748b",
    fontWeight: "500",
  },
  image: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyStateIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  emptyStateTitle: {
    fontSize: responsiveSize(20),
    fontWeight: "600",
    color: "#00695C",
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: responsiveSize(16),
    color: "#64748b",
    textAlign: "center",
    lineHeight: 22,
  },
});