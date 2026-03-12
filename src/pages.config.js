import Birthdays from './pages/Birthdays';
import Calendar from './pages/Calendar';
import Family from './pages/Family';
import FamilyStories from './pages/FamilyStories';
import Home from './pages/Home';
import LoveNotes from './pages/LoveNotes';
import Messages from './pages/Messages';
import Moments from './pages/Moments';
import Onboarding from './pages/Onboarding';
import Profile from './pages/Profile';
import Rituals from './pages/Rituals';
import Settings from './pages/Settings';
import TripDetail from './pages/TripDetail';
import Trips from './pages/Trips';
import __Layout from './Layout.jsx';


export const PAGES = {
    "birthdays": Birthdays,
    "calendar": Calendar,
    "family": Family,
    "family-stories": FamilyStories,
    "home": Home,
    "love-notes": LoveNotes,
    "messages": Messages,
    "moments": Moments,
    "onboarding": Onboarding,
    "profile": Profile,
    "rituals": Rituals,
    "settings": Settings,
    "trip-detail": TripDetail,
    "trips": Trips,
}

export const pagesConfig = {
    mainPage: "home",
    Pages: PAGES,
    Layout: __Layout,
};