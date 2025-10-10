import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import 'react-native-gesture-handler';
import 'react-native-reanimated';
import LoginScreen from "./LoginScreen";
import HomeScreen from "./HomeScreen";
import AnnouncementScreen from "./AnnouncementScreen";
import EventCalendarScreen from "./EventCalendarScreen";
import AccountingScreen from "./AccountingScreen";
import ComplaintsScreen from "./ComplaintsScreen";
import CommitteeScreen from "./CommitteeScreen";
import MembersScreen from "./MembersScreen";
import FileComplaintScreen from "./FileComplaintScreen";
import ProfileScreen from "./ProfileScreen";
import VotingScreen from "./VotingScreen";
import ElectionsScreen from "./ElectionsScreen";
import ElectionStatusScreen from "./ElectionStatusScreen";
import ViewMyVotesScreen from "./ViewMyVotesScreen";

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login">
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Announcement" component={AnnouncementScreen} />
        <Stack.Screen name="EventCalendar" component={EventCalendarScreen} />  
        <Stack.Screen name="Voting" component={VotingScreen} />
        <Stack.Screen name="Accounting" component={AccountingScreen} />
        <Stack.Screen name="Complaints" component={ComplaintsScreen} />
        <Stack.Screen name="Committee" component={CommitteeScreen} />
        <Stack.Screen name="Members" component={MembersScreen} />
        <Stack.Screen name="FileComplaint" component={FileComplaintScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="Elections" component={ElectionsScreen} />
        <Stack.Screen name="ElectionStatus" component={ElectionStatusScreen} />
        <Stack.Screen name="MyVotes" component={ViewMyVotesScreen} />
        
        </Stack.Navigator>
    </NavigationContainer>
  );
}


